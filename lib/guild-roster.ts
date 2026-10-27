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
  payload: { mode?: string; members?: RosterMember[]; excludedGids?: string[]; overrideGids?: string[]; forceIncludeGids?: string[] } | null;
  fetched_at: string;
};

// The existing Apps Script returns only the original Ping/Red subset.
// Rows in this private Supabase snapshot are taken from the owner's full
// guild roster sheet. When Apps Script begins supplying a guild itself,
// that live guild replaces this snapshot to avoid keeping former members.
const EXTRA_GUILDS = new Set(["아스가르드", "천제", "지옥소녀"]);

export async function includeUnreturnedGuilds<T extends RosterMember>(
  upstream: T[],
  upstreamUpdatedAt?: string,
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
      // Membership and identity remain curated, but newer Sheet growth/job
      // values must not be frozen at the reorganization snapshot's values.
      // Ignore older cached responses and ambiguous/reassigned identities.
      if (upstreamUpdatedAt &&
          Date.parse(upstreamUpdatedAt) > Date.parse(snapshot.fetched_at)) {
        const liveByGid = new Map<string, T>();
        const duplicateGids = new Set<string>();
        for (const live of upstream) {
          const gid = String(live.gid);
          if (liveByGid.has(gid)) duplicateGids.add(gid);
          liveByGid.set(gid, live);
        }
        return {
          members: members.map(member => {
            const gid = String(member.gid);
            const live = liveByGid.get(gid);
            const growth = Number(live?.growthPowerNumber);
            if (!live || duplicateGids.has(gid) ||
                String(live.nickname).trim() !== String(member.nickname).trim()) return member as T;
            const liveJob = String(live.job || "").trim();
            const job = liveJob === "앨리멘탈리스트" ? "엘리멘탈리스트" : liveJob;
            return {
              ...member,
              job: job || member.job,
              ...(Number.isFinite(growth) && growth > 0 ? {
                growthPower: growth.toLocaleString("en-US"),
                growthPowerNumber: growth,
              } : {}),
            } as T;
          }),
          supplementalUpdatedAt: snapshot.fetched_at,
        };
      }
      return { members: members as T[], supplementalUpdatedAt: snapshot.fetched_at };
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
