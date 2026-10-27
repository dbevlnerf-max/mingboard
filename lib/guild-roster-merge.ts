import type { RosterMember } from "./guild-roster";

type LiveFields = Pick<RosterMember, "gid" | "job" | "growthPower" | "growthPowerNumber">;

function normalizeJob(value: string): string {
  const job = String(value ?? "").trim();
  // Older Apps Script rows sometimes use this spelling for the same class.
  return job === "앨리멘탈리스트" ? "엘리멘탈리스트" : job;
}

function parseGrowth(member: LiveFields): number | null {
  const numeric = Number(member.growthPowerNumber);
  if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  const raw = String(member.growthPower ?? "").trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(raw)) return null;
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The curated roster owns identity, guild membership and nicknames.
 * An older Apps Script feed is never allowed to resurrect deleted GIDs
 * or overwrite curated guild/name changes; it only enriches verified GIDs.
 */
export function mergeLiveRoster<T extends LiveFields>(curated: T[], live: LiveFields[]) {
  const sources = new Map<string, LiveFields>();
  const duplicates = new Set<string>();
  for (const row of live) {
    if (!row) continue;
    const gid = String(row.gid ?? "").trim();
    if (!/^\d+$/.test(gid) || duplicates.has(gid)) continue;
    if (sources.has(gid)) {
      sources.delete(gid);
      duplicates.add(gid);
    } else {
      sources.set(gid, row);
    }
  }

  let liveMatchedCount = 0;
  let liveUpdatedCount = 0;
  const members = curated.map(member => {
    const current = sources.get(String(member.gid).trim());
    if (!current) return member;
    liveMatchedCount++;
    const job = normalizeJob(current.job);
    const growth = parseGrowth(current);
    const jobChanged = Boolean(job) && job !== member.job;
    const growthChanged = growth !== null && growth !== member.growthPowerNumber;
    if (!jobChanged && !growthChanged) return member;
    liveUpdatedCount++;
    return {
      ...member,
      ...(jobChanged ? { job } : {}),
      ...(growthChanged ? {
        growthPowerNumber: growth,
        growthPower: growth!.toLocaleString("en-US"),
      } : {}),
    } as T;
  });

  return { members, liveMatchedCount, liveUpdatedCount };
}
