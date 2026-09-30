import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  canReuseAccess, mergeVerifiedAccess, reuseAccess,
  type AccessClaims, type CharacterAccess, type DiscordAccess, type Verification,
} from "@/lib/access-policy";
import { verifyDiscordAccess } from "@/lib/discord-access";

const guildId = process.env.DISCORD_GUILD_ID!;
const zeusRoleId = process.env.DISCORD_ZEUS_ROLE_ID!;
const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID!;
const masterUserId = process.env.DISCORD_MASTER_USER_ID!;
const botToken = process.env.DISCORD_BOT_TOKEN!;
const context = JSON.stringify([guildId, zeusRoleId, adminRoleId, masterUserId]);

async function verifyCharacter(discordId: string): Promise<Verification<CharacterAccess>> {
  const signal = AbortSignal.timeout(5000);
  try {
    const { data: link, error: linkError } = await supabaseAdmin
      .from("guild_member_discord_links").select("gid")
      .eq("discord_id", discordId).is("revoked_at", null).abortSignal(signal).maybeSingle();
    if (linkError) throw linkError;
    if (!link) return { verified: true, value: { active: false, gid: null, status: null } };
    const { data: state, error: stateError } = await supabaseAdmin
      .from("guild_member_states").select("status").eq("gid", Number(link.gid))
      .abortSignal(signal).maybeSingle();
    if (stateError) throw stateError;
    const status = String(state?.status || "active");
    return { verified: true, value: { active: status === "active", gid: String(link.gid), status } };
  } catch {
    console.error("Character access verification temporarily unavailable");
    return { verified: false };
  }
}

type Check = {
  discord: Verification<DiscordAccess>;
  character: Verification<CharacterAccess>;
  checkedAt: number;
};
const checks = new Map<string, { until: number; promise: Promise<Check> }>();

function verifyAccess(discordId: string) {
  const key = `${context}:${discordId}`;
  const now = Date.now();
  for (const [key, entry] of checks) if (entry.until <= now) checks.delete(key);
  const current = checks.get(key);
  if (current) return current.promise;
  const entry = { until: now + 10000, promise: Promise.all([
    verifyDiscordAccess(discordId, { guildId, zeusRoleId, adminRoleId, botToken }),
    verifyCharacter(discordId),
  ]).then(([discord, character]) => ({ discord, character, checkedAt: Date.now() })) };
  checks.set(key, entry);
  while (checks.size > 1000) checks.delete(checks.keys().next().value!);
  return entry.promise;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Discord({
    clientId: process.env.AUTH_DISCORD_ID!, clientSecret: process.env.AUTH_DISCORD_SECRET!,
  })],
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      if (account && profile) token.discordId = String((profile as { id?: string }).id || "");
      const discordId = String(token.discordId || "");
      if (!discordId) return token;
      const isMaster = Boolean(masterUserId && discordId === masterUserId);
      token.isMaster = isMaster;
      const previous = token as AccessClaims;
      if (!account && trigger !== "update" && canReuseAccess(previous, context, Date.now())) {
        if (previous.authDegraded || previous.authVerificationPending) {
          Object.assign(token, reuseAccess(previous, context, isMaster, Date.now()));
        }
      } else {
        const result = await verifyAccess(discordId);
        const next = mergeVerifiedAccess(previous, result.discord, result.character, context, isMaster, Date.now());
        if (result.discord.verified) next.discordVerifiedAt = result.checkedAt;
        if (result.character.verified) next.characterVerifiedAt = result.checkedAt;
        Object.assign(token, next);
      }
      if (isMaster) token.isAdmin = true;
      token.needsCharacterLink = Boolean(token.isGuildMember && token.hasZeusRole &&
        !token.hasActiveCharacterLink && !isMaster && !token.authVerificationPending);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        Object.assign(session.user, {
          discordId: String(token.discordId || ""),
          isGuildMember: Boolean(token.isGuildMember),
          hasZeusRole: Boolean(token.hasZeusRole),
          isAdmin: Boolean(token.isAdmin), isMaster: Boolean(token.isMaster),
          hasActiveCharacterLink: Boolean(token.hasActiveCharacterLink),
          needsCharacterLink: Boolean(token.needsCharacterLink),
          linkedGid: token.linkedGid ? String(token.linkedGid) : undefined,
          characterStatus: token.characterStatus ? String(token.characterStatus) : undefined,
          authVerificationPending: Boolean(token.authVerificationPending),
          authDegraded: Boolean(token.authDegraded),
        });
      }
      return session;
    },
  },
  pages: { signIn: "/" },
});
