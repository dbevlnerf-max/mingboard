import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { mergeLiveRoster } from "@/lib/guild-roster-merge";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RosterMember } from "@/lib/guild-roster";

export const runtime = "nodejs";

type StoredPayload = {
  mode?: string;
  members?: RosterMember[];
  [key: string]: unknown;
};

function authorized(value: unknown): boolean {
  const expected = process.env.GUILD_WRITE_SECRET ?? "";
  if (!expected || typeof value !== "string") return false;
  const supplied = Buffer.from(value, "utf8");
  const trusted = Buffer.from(expected, "utf8");
  return supplied.length === trusted.length && timingSafeEqual(supplied, trusted);
}

/** GID-based single source of truth: 🧾길드현황 only.
 * Authenticated Apps Script sends all four guilds. Never import any legacy
 * 분배쳌 sheet, never delete a GID just because it is absent in a feed,
 * and never resurrect a GID whose lifecycle status is left.
 */
export async function POST(request: Request) {
  try {
    const body: { secret?: unknown; members?: unknown } = await request.json();
    if (!authorized(body.secret)) {
      return NextResponse.json({ success: false, message: "인증에 실패했습니다." }, { status: 401 });
    }
    const incoming = body.members;
    if (!Array.isArray(incoming) || incoming.length > 500 || incoming.length < 100) {
      return NextResponse.json({ success: false, message: "전체 길드 명단이 전달되지 않았습니다." }, { status: 422 });
    }
    const ids = new Set<string>();
    const guilds = new Map<string, number>();
    const names = new Set<string>();
    const allowed = new Set(["핑뚝", "천제", "아스가르드", "지옥소녀"]);
    for (const member of incoming) {
      if (!member || typeof member !== "object") {
        return NextResponse.json({ success: false, message: "잘못된 길드원 형식입니다." }, { status: 422 });
      }
      const id = String(member.gid ?? "").trim();
      const guild = String(member.guild ?? "").trim();
      const nickname = String(member.nickname ?? "").trim();
      const normalizedName = nickname.normalize("NFKC").toLocaleLowerCase("ko-KR");
      if (!/^\d+$/.test(id) || ids.has(id) || !allowed.has(guild) ||
          !nickname || [...nickname].length > 24 || names.has(normalizedName)) {
        return NextResponse.json({
          success: false, message: "원본 길드현황에 GID/닉네임 중복 또는 잘못된 길드명이 있습니다."
        }, { status: 422 });
      }
      ids.add(id); names.add(normalizedName);
      guilds.set(guild, (guilds.get(guild) || 0) + 1);
    }
    if (guilds.size !== 4 || [...guilds.values()].some(count => count < 10)) {
      return NextResponse.json({
        success: false, message: "핑뚝·천제·아스가르드·지옥소녀 전체 명단이 아닙니다."
      }, { status: 422 });
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      return NextResponse.json({ success: false, message: "길드 설정을 확인할 수 없습니다." }, { status: 503 });
    }
    const { data, error } = await supabaseAdmin.from("portal_sheet_snapshots")
      .select("payload,fetched_at")
      .eq("guild_id", guildId)
      .eq("source_key", "manual-guild-roster")
      .eq("query_key", "v1")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ success: false, message: "승인된 길드 명단을 찾지 못했습니다." }, { status: 503 });
    }
    const snapshot = data as { payload: StoredPayload; fetched_at: string };
    const confirmed = snapshot.payload?.members;
    if (snapshot.payload?.mode !== "authoritative" || !Array.isArray(confirmed) || !confirmed.length) {
      return NextResponse.json({ success: false, message: "승인된 명단 형식을 확인해주세요." }, { status: 409 });
    }
    const expectedIds = new Set(confirmed.map(member => String(member.gid)));
    if (expectedIds.size !== confirmed.length) {
      return NextResponse.json({ success: false, message: "저장된 명단 GID가 중복되었습니다." }, { status: 409 });
    }
    const matched = [...ids].filter(id => expectedIds.has(id)).length;
    const minimum = Math.ceil(confirmed.length * 0.8);
    if (matched < minimum) {
      return NextResponse.json({
        success: false,
        message: "원본 명단의 인원이 부족하여 기존 저장값을 보호했습니다.",
        matched, required: minimum,
      }, { status: 422 });
    }

    // Reconcile only active or not-yet-classified GIDs; explicitly departed
    // members remain excluded even if an old row is still on the source sheet.
    const { data: life, error: lifeError } = await supabaseAdmin
      .from("guild_member_states").select("gid,status")
      .in("gid", [...ids].map(Number));
    if (lifeError) return NextResponse.json({
      success: false, message: "탈퇴 여부를 확인하지 못했습니다."
    }, { status: 503 });
    const departed = new Set((life || []).filter(row => row.status === "left")
      .map(row => String(row.gid)));
    const managedGids = new Set(
      (Array.isArray(snapshot.payload.overrideGids) ? snapshot.payload.overrideGids : []).map(String)
    );
    const sourceRows = (incoming as RosterMember[]).filter(member =>
      !departed.has(String(member.gid)) && !managedGids.has(String(member.gid)));
    const merged = mergeLiveRoster(confirmed, sourceRows, {
      syncNickname: true, syncGuild: true, syncParticipation: true
    });
    // New sheet GIDs are added only if they are not departed and are unique.
    const existingIds = new Set(confirmed.map(member => String(member.gid)));
    const additions = sourceRows.filter(member => !existingIds.has(String(member.gid)))
      .map(member => ({
        ...member, gid:String(member.gid), nickname:String(member.nickname).trim(),
        guild:String(member.guild).trim(),
        growthPower:String(member.growthPower || ""),
        growthPowerNumber:Number(String(member.growthPowerNumber || member.growthPower || "0").replace(/,/g,"")) || 0,
        job:String(member.job || ""), no:String(member.no || ""),
        attendanceRate:String(member.attendanceRate ?? "0.00%"),
        participationCount:Number(member.participationCount || 0),
        targetCount:Number(member.targetCount || 0)
      }));
    const nextMembers = [...merged.members, ...additions];
    const changed = nextMembers.flatMap(member => {
      const before = confirmed.find(old => String(old.gid) === String(member.gid));
      if (!before) return [{before:null,after:member}];
      const fields = ["nickname", "guild", "job", "growthPower", "attendanceRate",
        "participationCount", "targetCount"] as const;
      return fields.some(field => String(before[field] ?? "") !== String(member[field] ?? ""))
        ? [{before,after:member}] : [];
    });
    const syncedAt = new Date().toISOString();
    const payload: StoredPayload = {
      ...snapshot.payload,
      members: nextMembers,
      liveSourceSyncedAt: syncedAt,
      liveSourceMatchedCount: matched,
      overrideGids: (snapshot.payload.overrideGids instanceof Array ? snapshot.payload.overrideGids : [])
        .filter(value => !ids.has(String(value))),
    };
    // Optimistic concurrency: another admin update must not be overwritten.
    const update = await supabaseAdmin.from("portal_sheet_snapshots")
      .update({ payload, fetched_at: syncedAt })
      .eq("guild_id", guildId)
      .eq("source_key", "manual-guild-roster")
      .eq("query_key", "v1")
      .eq("fetched_at", snapshot.fetched_at)
      .select("fetched_at")
      .maybeSingle();

    if (update.error) {
      console.error("Guild roster sync update failed:", update.error.code);
      return NextResponse.json({ success: false, message: "동기화 저장에 실패했습니다." }, { status: 503 });
    }
    if (!update.data) {
      return NextResponse.json({ success: false, message: "다른 수정이 반영되었습니다. 다음 주기에 다시 시도합니다." }, { status: 409 });
    }
    if (additions.length) {
      const { error: lifecycleError } = await supabaseAdmin.from("guild_member_states")
        .upsert(additions.map(member => ({
          gid:Number(member.gid),status:"active",
          updated_by:"system:sheet-reconciliation",reason:"원본 길드현황 신규 GID"
        })), {onConflict:"gid",ignoreDuplicates:true});
      if (lifecycleError) console.error("New sheet GID lifecycle save failed",lifecycleError.code);
    }
    if (changed.length) {
      const { error: auditError } = await supabaseAdmin.from("audit_logs").insert(
        changed.map(({before,after}) => ({
          action:"UPDATE",target_type:"guild_member",target_id:String(after.gid),
          target_name:after.nickname,actor_discord_id:"system:sheet-reconciliation",
          actor_name:"길드현황 GID 동기화",actor_role:"SYSTEM",
          before_data:before,after_data:after,
          description:"🧾길드현황 GID 기준 명단 자동 동기화"
        }))
      );
      if (auditError) console.error("Guild roster sync audit failed",auditError.code);
    }
    return NextResponse.json({
      success: true,
      syncedAt, matched: merged.liveMatchedCount,
      updated: merged.liveUpdatedCount,
      added: additions.length,
      total: nextMembers.length,
      excludedDeparted:departed.size,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Guild roster sync error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "길드 명단 동기화에 실패했습니다." }, { status: 500 });
  }
}
