import { supabaseAdmin } from "@/lib/supabase/admin";

export const MANAGED_GUILDS = ["핑뚝", "천제", "아스가르드", "지옥소녀"] as const;
export type ScopedGuild = "천제" | "아스가르드" | "지옥소녀";
export type MemberAccess = { kind: "full" } | { kind: "scoped"; guild: ScopedGuild } | { kind: "denied" };

const managerGuilds: ScopedGuild[] = ["천제", "아스가르드", "지옥소녀"];
export function isScopedGuild(value: string): value is ScopedGuild {
  return managerGuilds.includes(value as ScopedGuild);
}

/** An explicitly delegated operator must never fall back to full ADMIN,
 * even if their limited Discord role is later revoked or is unavailable. */
export async function isAssignedScopedOperator(discordId: string): Promise<boolean> {
  if (!discordId || !/^\d{15,22}$/.test(discordId)) return false;
  const { data, error } = await supabaseAdmin.from("guild_scoped_admin_assignments")
    .select("gid").eq("discord_id", discordId).maybeSingle();
  if (error) {
    // Fail closed for a broad role when the assignment lookup fails.
    throw new Error("담당자 권한을 확인할 수 없습니다.");
  }
  return Boolean(data);
}

export async function getScopedGuildFromDiscord(discordId: string): Promise<ScopedGuild | null> {
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!discordId || !/^\d{15,22}$/.test(discordId) || !guildId || !token) return null;
  const { data: assignment, error: lookupError } = await supabaseAdmin
    .from("guild_scoped_admin_assignments")
    .select("guild,gid,discord_id")
    .eq("discord_id", discordId).maybeSingle();
  if (lookupError || !assignment || !isScopedGuild(assignment.guild)) return null;
  const { data: row, error: roleError } = await supabaseAdmin
    .from("guild_scoped_admin_roles").select("role_id")
    .eq("guild", assignment.guild).maybeSingle();
  if (roleError || !row?.role_id) return null;
  const [linked, state] = await Promise.all([
    supabaseAdmin.from("guild_member_discord_links").select("gid")
      .eq("discord_id", discordId).eq("gid", assignment.gid)
      .is("revoked_at", null).maybeSingle(),
    supabaseAdmin.from("guild_member_states").select("status")
      .eq("gid", assignment.gid).maybeSingle(),
  ]);
  if (linked.error || !linked.data || state.error || state.data?.status !== "active") return null;
  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${token}` }, cache: "no-store",
        signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return null;
    const member = await response.json();
    if (!Array.isArray(member?.roles) || !member.roles.includes(row.role_id)) return null;
    // A role alone cannot grant access; account ID and active GID must also match.
    return assignment.guild;
  } catch {
    return null;
  }
}

export async function getMemberAccess(user: {
  discordId?: string; isAdmin?: boolean; isMaster?: boolean;
  isGuildMember?: boolean; hasZeusRole?: boolean; authVerificationPending?: boolean;
} | null | undefined): Promise<MemberAccess> {
  if (!user) return { kind: "denied" };
  // Scoped operator roles are standalone Discord permissions, not the
  // unrestricted ADMIN role. Their live role, verified Discord ID, active
  // GID and account link are checked by getScopedGuildFromDiscord.
  // Do not require an additional Zeus role or a stale JWT admin bit.
  if (!user.isMaster) {
    const guild = await getScopedGuildFromDiscord(String(user.discordId || ""));
    if (guild) return { kind: "scoped", guild };
    if (await isAssignedScopedOperator(String(user.discordId || "")))
      return { kind: "denied" }; // explicit assignment never falls back to full ADMIN
  }
  if (!user.isGuildMember || !user.hasZeusRole || user.authVerificationPending)
    return { kind: "denied" };
  return user.isAdmin || user.isMaster ? { kind: "full" } : { kind: "denied" };
}
