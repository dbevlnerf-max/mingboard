import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const SLOT_NAMES = new Set([
  "무기", "보조무기", "투구", "상의", "장갑", "망토",
  "신발", "하의", "귀걸이", "허리띠", "목걸이", "반지",
]);
const HISTORY_CATEGORIES = new Set(["무기", "보조무기", "방어구", "장신구"]);
type SourceMember = { gid: string; sourceNickname: string; slots: Array<{
  slot: string; item: string; enhancement: string; personal: boolean;
}> };
type History = { row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string };
type RosterMember = { gid: string | number; nickname: string; job: string;
  guild: string; growthPower: string };
function authorized(input: unknown) {
  const secret = process.env.GUILD_WRITE_SECRET;
  if (!secret || typeof input !== "string") return false;
  const left = Buffer.from(secret, "utf8");
  const right = Buffer.from(input, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 900000) {
      return NextResponse.json({ success: false, message: "요청 크기가 너무 큽니다." }, { status: 413 });
    }
    const body = await request.json();
    if (!authorized(body?.secret)) return NextResponse.json({
      success: false, message: "인증 실패",
    }, { status: 401 });
    if (!Array.isArray(body.members) || body.members.length < 50 || body.members.length > 250 ||
        !Array.isArray(body.history) || body.history.length > 3000) {
      return NextResponse.json({ success: false, message: "장비 또는 분배 이력 범위가 유효하지 않습니다." }, { status: 422 });
    }
    const rawMembers = body.members as SourceMember[];
    const idSet = new Set<string>();
    for (const member of rawMembers) {
      const gid = String(member?.gid || "").trim();
      if (!/^\d+$/.test(gid) || idSet.has(gid) || !Array.isArray(member.slots) ||
          member.slots.length !== 12 || !clean(member.sourceNickname, 200)) {
        return NextResponse.json({ success: false, message: "GID 또는 장비 블록이 잘못되었습니다." }, { status: 422 });
      }
      const slots = new Set<string>();
      for (const s of member.slots) {
        if (!SLOT_NAMES.has(s.slot) || slots.has(s.slot) || typeof s.item !== "string" ||
            s.item.length > 200 || typeof s.enhancement !== "string" ||
            s.enhancement.length > 60) {
          return NextResponse.json({ success: false, message: "장비 부위 형식이 잘못되었습니다." }, { status: 422 });
        }
        slots.add(s.slot);
      }
      idSet.add(gid);
    }
    const history = (body.history as History[]).map(h => ({
      row: Number(h?.row),
      date: clean(h?.date, 32),
      item: clean(h?.item, 200),
      category: clean(h?.category, 30),
      job: clean(h?.job, 60),
      target: clean(h?.target, 100),
      diamond: clean(h?.diamond, 40),
      notes: clean(h?.notes, 300),
    }));
    if (history.some(h => !Number.isInteger(h.row) || h.row < 1 ||
          !h.date || !h.item || !HISTORY_CATEGORIES.has(h.category))) {
      return NextResponse.json({ success: false, message: "분배 기록 형식이 잘못되었습니다." }, { status: 422 });
    }
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) return NextResponse.json({ success: false, message: "길드 설정 오류" }, { status: 503 });
    const [roster, previous] = await Promise.all([
      supabaseAdmin.from("portal_sheet_snapshots").select("payload")
        .eq("guild_id", guildId).eq("source_key", "manual-guild-roster")
        .eq("query_key", "v1").maybeSingle(),
      supabaseAdmin.from("portal_sheet_snapshots").select("payload")
        .eq("guild_id", guildId).eq("source_key", "manual-equipment-inventory")
        .eq("query_key", "v1").maybeSingle(),
    ]);
    if (roster.error || previous.error) throw (roster.error || previous.error);
    const canonical = (roster.data?.payload as { members?: RosterMember[] } | null)?.members;
    if (!Array.isArray(canonical) || canonical.length < 100) {
      return NextResponse.json({ success: false, message: "기준 GID 명단이 없습니다." }, { status: 503 });
    }
    const rosterById = new Map(canonical.map(m => [String(m.gid), m]));
    if (idSet.size !== rawMembers.length || rawMembers.some(m => !rosterById.has(String(m.gid)))) {
      return NextResponse.json({ success: false, message: "확인되지 않은 GID가 있습니다." }, { status: 422 });
    }
    const before = previous.data?.payload as { members?: unknown[]; history?: unknown[] } | null;
    const minimum = Math.max(50, Math.floor((before?.members?.length || 0) * 0.8));
    if (rawMembers.length < minimum) {
      return NextResponse.json({ success: false,
        message: "장비 자료가 급감해 기존 데이터 보호를 위해 저장하지 않았습니다.", minimum,
      }, { status: 422 });
    }
    if (history.length < Math.floor((before?.history?.length || 0) * 0.6)) {
      return NextResponse.json({ success: false, message: "분배 이력이 급감해 기존 데이터를 보호했습니다." }, { status: 422 });
    }
    const members = rawMembers.map(m => {
      const r = rosterById.get(String(m.gid))!;
      return {
        gid: String(m.gid), nickname: clean(r.nickname, 100),
        sourceNickname: clean(m.sourceNickname, 100),
        guild: clean(r.guild, 50), job: clean(r.job, 60),
        growthPower: clean(String(r.growthPower ?? ""), 40),
        slots: m.slots.map(s => ({
          slot: s.slot, item: clean(s.item, 200),
          enhancement: clean(s.enhancement, 60), personal: Boolean(s.personal),
        })),
      };
    });
    const fetchedAt = new Date().toISOString();
    const payload = { success: true, schemaVersion: 1, members, history,
      sourceSheet: "길드원 착용장비",
      sourceSummary: { registered: members.length, rosterCount: canonical.length,
        equipmentDistributionRows: history.length } };
    const result = await supabaseAdmin.from("portal_sheet_snapshots")
      .upsert({ guild_id: guildId, source_key: "manual-equipment-inventory",
        query_key: "v1", action: "guild", payload, fetched_at: fetchedAt,
        invalidated_at: null }, { onConflict: "guild_id,source_key,query_key" });
    if (result.error) throw result.error;
    return NextResponse.json({ success: true, syncedAt: fetchedAt,
      registered: members.length, history: history.length },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Equipment sync failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "장비 자동 동기화에 실패했습니다." }, { status: 500 });
  }
}
