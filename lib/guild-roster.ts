import { supabaseAdmin } from "@/lib/supabase/admin";

export type RosterMember = {
  gid: string;
  nickname: string;
  job: string;
  growthPower: string;
  growthPowerNumber: number;
  guild: string;
  attendanceRate: string;
  participationCount: number;
  targetCount: number;
  no?: string;
};

type SupplementalSnapshot = {
  payload: { members?: RosterMember[] } | null;
  fetched_at: string;
};

// The existing Apps Script returns only the original Ping/Red subset.
// Rows in this private Supabase snapshot are taken from the owner's full
// guild roster sheet. When Apps Script begins supplying a guild itself,
// that live guild replaces this snapshot to avoid keeping former members.
const EXTRA_GUILDS = new Set(["테온", "지옥소녀", "헤븐"]);

export async function includeUnreturnedGuilds<T extends RosterMember>(
  upstream: T[]
): Promise<{ members: T[]; supplementalUpdatedAt: string | null }> {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return { members: upstream, supplementalUpdatedAt: null };

  try {
    const { data, error } = await supabaseAdmin
      .from("portal_sheet_snapshots")
      .select("payload,fetched_at")
      .eq("guild_id", guildId)
      .eq("source_key", "manual-guild-roster")
      .eq("query_key", "v1")
      .maybeSingle();

    if (error) {
      console.error("Guild roster supplement read failed:", error.code);
      return { members: upstream, supplementalUpdatedAt: null };
    }

    const snapshot = data as SupplementalSnapshot | null;
    const supplemental = snapshot?.payload?.members;
    if (!Array.isArray(supplemental)) {
      return { members: upstream, supplementalUpdatedAt: null };
    }

    const upstreamGuilds = new Set(upstream.map(member => member.guild));
    const usedGids = new Set(upstream.map(member => String(member.gid)));
    const members = [...upstream];

    for (const member of supplemental) {
      if (!member || !EXTRA_GUILDS.has(member.guild)) continue;
      // When the upstream Apps Script supports that guild, use its live
      // roster instead of retaining static supplemental rows.
      if (upstreamGuilds.has(member.guild)) continue;

      const gid = String(member.gid ?? "").trim();
      const nickname = String(member.nickname ?? "").trim();
      if (!/^\d+$/.test(gid) || !nickname || usedGids.has(gid)) continue;

      usedGids.add(gid);
      members.push({ ...member, gid, nickname } as T);
    }

    return { members, supplementalUpdatedAt: snapshot?.fetched_at ?? null };
  } catch (error) {
    console.error("Guild roster supplement unavailable:", error);
    return { members: upstream, supplementalUpdatedAt: null };
  }
}
