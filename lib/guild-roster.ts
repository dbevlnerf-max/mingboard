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
  payload: { members?: RosterMember[]; excludedGids?: string[]; overrideGids?: string[]; forceIncludeGids?: string[] } | null;
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

    // The owner may retire a member or temporarily clear their guild even
    // while the upstream Apps Script still serves its previous cached row.
    const excludedGids = new Set((snapshot?.payload?.excludedGids ?? []).map(String));
    const overrideGids = new Set((snapshot?.payload?.overrideGids ?? []).map(String));
    // Newly registered Ping guild members may be missing from the legacy
    // Apps Script response. Include only explicitly vetted GIDs.
    const forceIncludeGids = new Set((snapshot?.payload?.forceIncludeGids ?? []).map(String));
    const overrides = new Map(
      supplemental
        .filter(member => member && overrideGids.has(String(member.gid)))
        .map(member => [String(member.gid), member]),
    );

    const currentUpstream = upstream
      .filter(member => !excludedGids.has(String(member.gid)))
      .map(member => {
        const changed = overrides.get(String(member.gid));
        return changed ? { ...member, ...changed } as T : member;
      });

    const upstreamGuilds = new Set(currentUpstream.map(member => member.guild));
    const usedGids = new Set(currentUpstream.map(member => String(member.gid)));
    const members = [...currentUpstream];

    for (const member of supplemental) {
      // No-guild members must stay on the overall roster but are not
      // counted toward the four representative guilds.
      if (!member || !(EXTRA_GUILDS.has(member.guild) || member.guild === "" || forceIncludeGids.has(String(member.gid)))) continue;
      if (member.guild && upstreamGuilds.has(member.guild)) continue;

      const gid = String(member.gid ?? "").trim();
      const nickname = String(member.nickname ?? "").trim();
      if (!/^\d+$/.test(gid) || !nickname || usedGids.has(gid) || excludedGids.has(gid)) continue;

      usedGids.add(gid);
      members.push({ ...member, gid, nickname } as T);
    }

    return { members, supplementalUpdatedAt: snapshot?.fetched_at ?? null };
  } catch (error) {
    console.error("Guild roster supplement unavailable:", error);
    return { members: upstream, supplementalUpdatedAt: null };
  }
}
