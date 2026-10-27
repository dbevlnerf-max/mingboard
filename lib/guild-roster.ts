import { supabaseAdmin } from "@/lib/supabase/admin";
import { mergeLiveRoster } from "@/lib/guild-roster-merge";

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
  payload: { mode?: string; members?: RosterMember[]; excludedGids?: string[]; overrideGids?: string[]; forceIncludeGids?: string[];
    liveSourceSyncedAt?: string; liveSourceMatchedCount?: number } | null;
  fetched_at: string;
};

// The existing Apps Script returns only the original Ping/Red subset.
// Rows in this private Supabase snapshot are taken from the owner's full
// guild roster sheet. When Apps Script begins supplying a guild itself,
// that live guild replaces this snapshot to avoid keeping former members.
const EXTRA_GUILDS = new Set(["아스가르드", "천제", "지옥소녀"]);

export async function includeUnreturnedGuilds<T extends RosterMember>(
  upstream: T[]
): Promise<{ members: T[]; supplementalUpdatedAt: string | null; liveMatchedCount?: number; liveUpdatedCount?: number;
  liveSourceSyncedAt?: string | null; liveSourceMatchedCount?: number | null }> {
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

    // After the 2026-10-26 reorganization, the curated full roster is the
    // only authoritative member list. The old Apps Script still returns
    // legacy Ping/Red names and must not reintroduce departed characters.
    // Preserve each confirmed GID for authentication, history, and transfers.
    if (snapshot?.payload?.mode === "authoritative") {
      const members = supplemental.filter(member => member &&
        /^\d+$/.test(String(member.gid)) &&
        Boolean(String(member.nickname || "").trim()));
      const uniqueIds = new Set(members.map(member => String(member.gid)));
      if (members.length !== supplemental.length || uniqueIds.size !== members.length) {
        console.error("Authoritative guild roster has invalid GIDs");
        return { members: [], supplementalUpdatedAt: snapshot.fetched_at };
      }
      // The complete sheet sync owns job/growth once it has succeeded.
      // A stale legacy feed must never overwrite its 186 verified entries.
      const merged = snapshot.payload.liveSourceSyncedAt
        ? { members: members as T[] }
        : mergeLiveRoster(members as T[], upstream);
      return {
        ...merged, supplementalUpdatedAt: snapshot.fetched_at,
        liveSourceSyncedAt: snapshot.payload.liveSourceSyncedAt ?? null,
        liveSourceMatchedCount: snapshot.payload.liveSourceMatchedCount ?? null,
      };
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
      if (member.guild && upstreamGuilds.has(member.guild) &&
          !forceIncludeGids.has(String(member.gid))) continue;

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
