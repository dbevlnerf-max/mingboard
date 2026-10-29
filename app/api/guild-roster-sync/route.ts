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

/**
 * An Apps Script time-driven trigger posts the full four-guild roster here.
 * Only growth and job are refreshed; approved GIDs, names, guilds,
 * Discord links, membership status and history are never overwritten.
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
    for (const member of incoming) {
      if (!member || typeof member !== "object") {
        return NextResponse.json({ success: false, message: "잘못된 길드원 형식입니다." }, { status: 422 });
      }
      const id = String(member.gid ?? "").trim();
      if (!/^\d+$/.test(id) || ids.has(id)) {
        return NextResponse.json({ success: false, message: "GID 누락 또는 중복입니다." }, { status: 422 });
      }
      ids.add(id);
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

    // Web admin edits are explicit owner-approved overrides. A later stale
    // Google Sheet sync must not silently undo them.
    const managedGids = new Set(
      (Array.isArray(snapshot.payload.overrideGids) ? snapshot.payload.overrideGids : [])
        .map(String)
    );
    const sourceRows = (incoming as RosterMember[])
      .filter(member => !managedGids.has(String(member.gid)));
    const merged = mergeLiveRoster(confirmed, sourceRows);
    const syncedAt = new Date().toISOString();
    const payload: StoredPayload = {
      ...snapshot.payload,
      members: merged.members,
      liveSourceSyncedAt: syncedAt,
      liveSourceMatchedCount: matched,
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
    return NextResponse.json({
      success: true,
      syncedAt,
      matched: merged.liveMatchedCount,
      updated: merged.liveUpdatedCount,
      total: confirmed.length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Guild roster sync error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: "길드 명단 동기화에 실패했습니다." }, { status: 500 });
  }
}
