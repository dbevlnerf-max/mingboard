import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

import { supabaseAdmin } from "@/lib/supabase/admin";

const guildId = process.env.DISCORD_GUILD_ID!;
const zeusRoleId = process.env.DISCORD_ZEUS_ROLE_ID!;
const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID!;
const masterUserId = process.env.DISCORD_MASTER_USER_ID!;
const botToken = process.env.DISCORD_BOT_TOKEN!;

async function getDiscordMember(userId: string) {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[AUTH] Discord member lookup error:", error);
    return null;
  }
}

async function getCharacterAccess(discordId: string) {
  try {
    const { data: link, error: linkError } = await supabaseAdmin
      .from("guild_member_discord_links")
      .select("gid, revoked_at, revoke_reason")
      .eq("discord_id", discordId)
      .is("revoked_at", null)
      .maybeSingle();

    if (linkError) {
      throw linkError;
    }

    if (!link) {
      return {
        linked: false,
        gid: null,
        status: null,
      };
    }

    const { data: state, error: stateError } = await supabaseAdmin
      .from("guild_member_states")
      .select("status")
      .eq("gid", Number(link.gid))
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    const status = String(state?.status || "active");

    return {
      linked: status === "active",
      gid: String(link.gid),
      status,
    };
  } catch (error) {
    console.error("[AUTH] character access lookup error:", error);

    return {
      linked: false,
      gid: null,
      status: "error",
    };
  }
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID!,
      clientSecret: process.env.AUTH_DISCORD_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const discordProfile = profile as {
          id?: string;
        };

        token.discordId = String(discordProfile.id || "");
      }

      const discordId = String(token.discordId || "");

      if (!discordId) {
        return token;
      }

      token.isMaster = discordId === masterUserId;

      const member = await getDiscordMember(discordId);

      token.isGuildMember = Boolean(member);

      const roles: string[] =
        member && Array.isArray(member.roles)
          ? member.roles
          : [];

      token.discordHasZeusRole = roles.includes(zeusRoleId);
      token.isAdmin = roles.includes(adminRoleId);

      if (token.isMaster) {
        token.isAdmin = true;
      }

      const characterAccess = await getCharacterAccess(discordId);

      token.hasActiveCharacterLink = characterAccess.linked;
      token.linkedGid = characterAccess.gid || undefined;
      token.characterStatus = characterAccess.status || undefined;

      token.needsCharacterLink = Boolean(
        token.isGuildMember &&
        token.discordHasZeusRole &&
        !token.hasActiveCharacterLink &&
        !token.isMaster
      );

      token.hasZeusRole = Boolean(
        token.isMaster ||
        (
          token.isGuildMember &&
          token.discordHasZeusRole &&
          token.hasActiveCharacterLink
        )
      );

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = String(token.discordId || "");
        session.user.isGuildMember = Boolean(token.isGuildMember);
        session.user.discordHasZeusRole = Boolean(token.discordHasZeusRole);
        session.user.hasZeusRole = Boolean(token.hasZeusRole);
        session.user.hasActiveCharacterLink = Boolean(token.hasActiveCharacterLink);
        session.user.needsCharacterLink = Boolean(token.needsCharacterLink);
        session.user.linkedGid = token.linkedGid
          ? String(token.linkedGid)
          : undefined;
        session.user.characterStatus = token.characterStatus
          ? String(token.characterStatus)
          : undefined;
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.isMaster = Boolean(token.isMaster);
      }

      return session;
    },
  },

  pages: {
    signIn: "/",
  },
});
