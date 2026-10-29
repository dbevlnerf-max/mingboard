import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberAccess } from "@/lib/guild-scoped-admin";
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
  const access = await getMemberAccess(session?.user);
  if (access.kind === "denied") {
    return NextResponse.json({ success: false, message: "장비 데이터 접근 권한이 없습니다." },
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
    const currentRoster = (Array.isArray(rosterPayload?.members) ? rosterPayload.members : [])
      .filter(m => access.kind === "full" || m.guild === access.guild);
    const rosterByGid = new Map(currentRoster.map(m => [String(m.gid), m]));

    // Rankings use the full, approved active roster, not just members
    // who have an equipment-inventory entry. Unranked/invalid powers
    // are excluded rather than assigning an invented position.
    const rankedMembers = currentRoster.map(member => ({
      gid: String(member.gid),
      job: String(member.job ?? "").trim().replace("앨리멘탈리스트", "엘리멘탈리스트"),
      power: Number(String(member.growthPower ?? "").replace(/,/g, "")),
    })).filter(member => Number.isFinite(member.power) && member.power > 0);
    const byPower = (a: typeof rankedMembers[number], b: typeof rankedMembers[number]) =>
      b.power - a.power || a.gid.localeCompare(b.gid, "ko-KR");
    const overall = [...rankedMembers].sort(byPower);
    const byJob = new Map<string, typeof rankedMembers>();
    for (const member of rankedMembers) {
      const bucket = byJob.get(member.job) ?? [];
      bucket.push(member);
      byJob.set(member.job, bucket);
    }
    const overallPositions = new Map<string, number>();
    overall.forEach((member, index) => overallPositions.set(
      member.gid, index > 0 && overall[index - 1].power === member.power
        ? overallPositions.get(overall[index - 1].gid)! : index + 1
    ));
    const rankingByGid: Record<string, {
      jobRank: number; jobTotal: number; overallRank: number; overallTotal: number;
    }> = {};
    for (const [job, bucket] of byJob) {
      bucket.sort(byPower);
      let rank = 0;
      bucket.forEach((member, index) => {
        if (index === 0 || member.power !== bucket[index - 1].power) rank = index + 1;
        rankingByGid[member.gid] = {
          jobRank: rank,
          jobTotal: bucket.length,
          overallRank: overallPositions.get(member.gid) ?? 0,
          overallTotal: overall.length,
        };
      });
    }
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
    const members = valid.filter(member =>
      access.kind === "full" || rosterByGid.has(String(member.gid))
    ).map(member => {
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
    const scopedNames = new Set(currentRoster.map(member => String(member.nickname ?? "").trim()));
    const visibleHistory = (entries: History[]) => access.kind === "full"
      ? entries : entries.filter(entry => scopedNames.has(String(entry.target || "").trim()));
    const allSkills = Array.isArray(payload?.skillHistory) && payload.skillHistory.length
      ? payload.skillHistory
      : (Array.isArray((legacySkills.data?.payload as { history?: History[] } | null)?.history)
        ? (legacySkills.data?.payload as { history: History[] }).history : []);
    return NextResponse.json({
      success: true, members, scope: access.kind === "full" ? null : access.guild,
      catalog: (catalog.data ?? []) as EquipmentCatalogItem[],
      history: visibleHistory(Array.isArray(payload?.history) ? payload.history : []).slice(0,3000),
      skillHistory: visibleHistory(allSkills).slice(0,1000),
      sourceSummary: access.kind === "full" ? payload?.sourceSummary ?? {} : {},
      updatedAt: equipment.data?.fetched_at ?? null,
      rosterTotal: currentRoster.length,
      rosterMembers: currentRoster.map(member => ({
        gid: String(member.gid),
        nickname: String(member.nickname ?? ""),
        job: String(member.job ?? ""),
        guild: String(member.guild ?? ""),
        growthPower: String(member.growthPower ?? ""),
      })),
      rankingByGid,
      readOnly: true,
    }, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
  } catch (error) {
    console.error("Equipment inventory read failed:", error);
    return NextResponse.json({
      success: false, message: "장비 데이터를 조회하지 못했습니다.",
    }, { status: 502 });
  }
}
