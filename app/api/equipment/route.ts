import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { EquipmentCatalogItem } from "@/lib/equipment-catalog";

type Member = {
  gid: string; nickname: string; sourceNickname: string; guild: string;
  job: string; growthPower: string;
  slots: Array<{ slot: string; item: string; enhancement: string; personal: boolean }>;
};
type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};

export async function GET() {
  const session = await auth();
  if (session?.user?.authVerificationPending) {
    return NextResponse.json({ success: false, message: "인증 상태를 확인 중입니다." }, { status: 503 });
  }
  if (!session?.user || !(session.user.isAdmin || session.user.isMaster)) {
    return NextResponse.json({ success: false, message: "관리자 권한이 필요합니다." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) throw new Error("Missing configured guild");
    const [equipment, roster, catalog, legacySkills] = await Promise.all([
      supabaseAdmin.from("portal_sheet_snapshots")
        .select("payload,fetched_at")
        .eq("guild_id", guildId).eq("source_key", "manual-equipment-inventory")
        .eq("query_key", "v1").maybeSingle(),
      supabaseAdmin.from("portal_sheet_snapshots")
        .select("payload").eq("guild_id", guildId)
        .eq("source_key", "manual-guild-roster").eq("query_key", "v1").maybeSingle(),
      supabaseAdmin.from("equipment_item_catalog")
        .select("item_id,item_name,slot,rarity,tier,equipment_kind,job_class,aliases,icon_asset,sprite_index,sprite_columns,icon_verified")
        .eq("icon_verified", true)
        .order("tier", { ascending: true })
        .limit(1000),
      supabaseAdmin.from("portal_sheet_snapshots")
        .select("payload").eq("guild_id", guildId)
        .eq("source_key", "manual-skill-distribution")
        .eq("query_key", "v1").maybeSingle(),
    ]);
    if (equipment.error) throw equipment.error;
    if (roster.error) throw roster.error;
    if (catalog.error) throw catalog.error;
    if (legacySkills.error) throw legacySkills.error;

    const payload = equipment.data?.payload as {
      members?: Member[]; history?: History[]; skillHistory?: History[]; sourceSummary?: Record<string, number>;
    } | null;
    const sourceMembers = payload?.members;
    if (!Array.isArray(sourceMembers)) {
      return NextResponse.json({
        success: false,
        message: "장비 현황이 아직 동기화되지 않았습니다.",
      }, { status: 503 });
    }
    const rosterPayload = roster.data?.payload as {
      members?: Array<{ gid: string | number; nickname?: string; job?: string; guild?: string; growthPower?: string }>;
    } | null;
    const currentRoster = Array.isArray(rosterPayload?.members) ? rosterPayload.members : [];
    const rosterByGid = new Map(currentRoster.map(m => [String(m.gid), m]));
    const valid = (sourceMembers as Member[]).filter(m =>
      m && /^\d+$/.test(String(m.gid)) && Array.isArray(m.slots) &&
      m.slots.length === 12
    );
    if (valid.length !== sourceMembers.length ||
        new Set(valid.map(m => String(m.gid))).size !== valid.length) {
      throw new Error("Invalid equipment snapshot");
    }
    // Never equate a historical distribution entry with current ownership.
    // Current inventory always comes from the equipment sheet by immutable GID.
    const members = valid.map(member => {
      const current = rosterByGid.get(String(member.gid));
      return {
        ...member,
        nickname: current?.nickname || member.nickname,
        guild: current?.guild ?? member.guild,
        job: current?.job || member.job,
        growthPower: current?.growthPower || member.growthPower,
        rosterMatched: Boolean(current),
      };
    });
    return NextResponse.json({
      success: true, members,
      catalog: (catalog.data ?? []) as EquipmentCatalogItem[],
      history: Array.isArray(payload?.history) ? payload.history.slice(0, 3000) : [],
      skillHistory: Array.isArray(payload?.skillHistory) && payload.skillHistory.length
        ? payload.skillHistory.slice(0, 1000)
        : (Array.isArray((legacySkills.data?.payload as { history?: History[] } | null)?.history)
          ? (legacySkills.data?.payload as { history: History[] }).history.slice(0, 1000) : []),
      sourceSummary: payload?.sourceSummary ?? {},
      updatedAt: equipment.data?.fetched_at ?? null,
      rosterTotal: currentRoster.length,
      readOnly: true,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
  } catch (error) {
    console.error("Equipment inventory read failed:", error);
    return NextResponse.json({
      success: false, message: "장비 데이터를 조회하지 못했습니다.",
    }, { status: 502 });
  }
}
