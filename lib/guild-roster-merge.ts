import type { RosterMember } from "./guild-roster";

type LiveFields = Pick<RosterMember, "gid" | "job" | "growthPower" | "growthPowerNumber"> &
  Partial<Pick<RosterMember, "nickname" | "guild">>;

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
 * Legacy responses ONLY enrich power/job. A complete, authenticated four-guild
 * roster sync may also refresh nicknames after matching the immutable GID and
 * verifying same guild and unique destination names. Never rename by partial
 * string matching or allow a stale legacy response to undo approved nicknames.
 */
export function mergeLiveRoster<T extends LiveFields>(
  curated: T[], live: LiveFields[], options: { syncNickname?: boolean } = {}
) {
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

  // Guard against duplicates on either side of the rename.
  const normalizedName = (value: string) => value.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  const newNameCounts = new Map<string, number>();
  if (options.syncNickname) {
    for (const row of sources.values()) {
      const name = normalizedName(String(row.nickname || ""));
      if (name) newNameCounts.set(name, (newNameCounts.get(name) || 0) + 1);
    }
  }
  const curatedNameOwner = new Map(curated.map(member => [
    normalizedName(String(member.nickname || "")), String(member.gid),
  ]));
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
    const nextNickname = String(current.nickname || "").trim();
    const matchedGuild = String(current.guild || "") === String(member.guild || "");
    const nameKey = normalizedName(nextNickname);
    const existingOwner = curatedNameOwner.get(nameKey);
    const canRename = Boolean(options.syncNickname && matchedGuild &&
      nextNickname && [...nextNickname].length <= 24 &&
      !/[\u0000-\u001f\u007f]/u.test(nextNickname) &&
      newNameCounts.get(nameKey) === 1 &&
      (!existingOwner || existingOwner === String(member.gid)));
    const nicknameChanged = canRename && nextNickname !== member.nickname;
    if (!jobChanged && !growthChanged && !nicknameChanged) return member;
    liveUpdatedCount++;
    return {
      ...member,
      ...(jobChanged ? { job } : {}),
      ...(nicknameChanged ? { nickname: nextNickname } : {}),
      ...(growthChanged ? {
        growthPowerNumber: growth,
        growthPower: growth!.toLocaleString("en-US"),
      } : {}),
    } as T;
  });

  return { members, liveMatchedCount, liveUpdatedCount };
}
