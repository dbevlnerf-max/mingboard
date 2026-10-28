import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RosterMember } from "@/lib/guild-roster";

type ArchivedMember = RosterMember & { status?: string; leftAt?: string };
type RosterPayload = {
  success: boolean;
  mode?: string;
  members?: ArchivedMember[];
  [key: string]: unknown;
};
type Snapshot = { payload: RosterPayload; fetched_at: string };

const ACTIVE_SOURCE = "manual-guild-roster";
const ARCHIVE_SOURCE = "manual-guild-departed";

function guildId(): string {
  const id = process.env.DISCORD_GUILD_ID;
  if (!id) throw new Error("길드 설정을 확인할 수 없습니다.");
  return id;
}

async function getSnapshot(sourceKey: string): Promise<Snapshot | null> {
  const { data, error } = await supabaseAdmin
    .from("portal_sheet_snapshots")
    .select("payload,fetched_at")
    .eq("guild_id", guildId())
    .eq("source_key", sourceKey)
    .eq("query_key", "v1")
    .maybeSingle();
  if (error) throw new Error("길드원 명단을 확인할 수 없습니다.");
  return (data as Snapshot | null);
}

/** null means this installation still uses the legacy Apps Script roster. */
export async function findCuratedMember(gid: string): Promise<{
  member: ArchivedMember | null;
} | null> {
  const snapshot = await getSnapshot(ACTIVE_SOURCE);
  if (!snapshot || snapshot.payload?.mode !== "authoritative" ||
      !Array.isArray(snapshot.payload.members)) return null;
  return {
    member: snapshot.payload.members.find(item => String(item.gid) === gid) ?? null,
  };
}

/** Preserve the original character record; only the active list changes. */
export async function archiveCuratedMember(gid: string): Promise<void> {
  const snapshot = await getSnapshot(ACTIVE_SOURCE);
  if (!snapshot || snapshot.payload?.mode !== "authoritative" ||
      !Array.isArray(snapshot.payload.members)) {
    throw new Error("승인된 길드원 명단을 찾을 수 없습니다.");
  }
  const member = snapshot.payload.members.find(item => String(item.gid) === gid);
  if (!member) throw new Error("현재 길드원 명단에서 대상을 찾을 수 없습니다.");

  const now = new Date().toISOString();
  const archive = await getSnapshot(ARCHIVE_SOURCE);
  const previous = Array.isArray(archive?.payload?.members)
    ? archive.payload.members : [];
  const archivedMember: ArchivedMember = { ...member, status: "left", leftAt: now };
  const archivePayload: RosterPayload = {
    ...(archive?.payload ?? { success: true, mode: "authoritative" }),
    success: true,
    members: [...previous.filter(item => String(item.gid) !== gid), archivedMember],
  };

  // Save the complete member record before removing them from the active roster.
  const { error: archiveError } = await supabaseAdmin
    .from("portal_sheet_snapshots")
    .upsert({
      guild_id: guildId(),
      source_key: ARCHIVE_SOURCE,
      query_key: "v1",
      action: "guild",
      payload: archivePayload,
      fetched_at: now,
    }, { onConflict: "guild_id,source_key,query_key" });
  if (archiveError) throw new Error("탈퇴자 정보 보관에 실패했습니다.");

  const remaining = snapshot.payload.members.filter(item => String(item.gid) !== gid);
  const { data, error } = await supabaseAdmin
    .from("portal_sheet_snapshots")
    .update({
      payload: { ...snapshot.payload, members: remaining },
      fetched_at: now,
      invalidated_at: null,
    })
    .eq("guild_id", guildId())
    .eq("source_key", ACTIVE_SOURCE)
    .eq("query_key", "v1")
    .eq("fetched_at", snapshot.fetched_at)
    .select("fetched_at")
    .maybeSingle();

  if (error) throw new Error("활동 명단 변경에 실패했습니다.");
  if (!data) throw new Error("명단이 동시에 변경됐습니다. 새로고침한 뒤 재시도해주세요.");
}

export async function getArchivedCuratedMembers(): Promise<ArchivedMember[]> {
  const snapshot = await getSnapshot(ARCHIVE_SOURCE);
  return Array.isArray(snapshot?.payload?.members) ? snapshot.payload.members : [];
}
