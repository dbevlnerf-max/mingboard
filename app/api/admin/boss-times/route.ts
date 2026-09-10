import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/audit";

type SpawnType = "interval" | "fixed";

const adminGuildId = () => process.env.MINGBOT_PRIMARY_GUILD_ID?.trim() || "legacy";
const text = (value: unknown) => String(value ?? "").trim();
const uniqueTexts = (value: unknown) => Array.isArray(value)
  ? Array.from(new Set(value.map(text).filter(Boolean)))
  : [];

function fixedTimes(value: unknown) {
  const times = uniqueTexts(value);
  const invalid = times.find(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  if (invalid) throw new Error(`고정젠 시간 형식이 올바르지 않습니다: ${invalid}`);
  return times.sort();
}

function nullableLevel(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new Error("보스 레벨이 올바르지 않습니다.");
  return n;
}

function nullableIsoDate(value: unknown) {
  const clean = text(value);
  if (!clean) return null;
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) throw new Error("다음 소환시간 형식이 올바르지 않습니다.");
  return date.toISOString();
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401, message: "로그인이 필요합니다.", session: null };
  if (!session.user.isAdmin && !session.user.isMaster) {
    return { ok: false as const, status: 403, message: "관리자 권한이 필요합니다.", session };
  }
  return { ok: true as const, status: 200, message: "", session };
}

async function getBoss(id: string) {
  const { data, error } = await supabaseAdmin.from("boss_timers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function getAllBosses() {
  const { data: bosses, error: bossError } = await supabaseAdmin
    .from("boss_timers")
    .select("*")
    .order("enabled", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (bossError) throw bossError;

  const ids = (bosses || []).map(b => b.id);
  let states: any[] = [];
  if (ids.length) {
    const { data, error } = await supabaseAdmin
      .from("boss_timer_states")
      .select("*")
      .eq("guild_id", adminGuildId())
      .in("boss_id", ids);
    if (error) throw error;
    states = data || [];
  }

  const stateMap = new Map(states.map(s => [s.boss_id, s]));
  return (bosses || []).map(boss => {
    const state = stateMap.get(boss.id);
    return {
      id: boss.id,
      name: boss.name,
      aliases: Array.isArray(boss.aliases) ? boss.aliases : [],
      level: boss.level,
      spawnType: boss.spawn_type,
      intervalMinutes: boss.interval_minutes,
      fixedTimes: Array.isArray(boss.fixed_times) ? boss.fixed_times : [],
      enabled: boss.enabled,
      sortOrder: boss.sort_order,
      description: boss.description || "",
      lastSpawnAt: state?.last_spawn_at || null,
      nextSpawnAt: state?.next_spawn_at || null,
      stateSource: state?.source || null,
      stateUpdatedAt: state?.updated_at || null,
      updatedAt: boss.updated_at,
      guildId: adminGuildId(),
    };
  });
}

function buildBossPayload(body: Record<string, unknown>) {
  const name = text(body.name);
  if (!name) throw new Error("보스 이름을 입력해주세요.");
  const spawnType = text(body.spawnType) as SpawnType;
  if (spawnType !== "interval" && spawnType !== "fixed") throw new Error("출현 방식을 선택해주세요.");

  const level = nullableLevel(body.level);
  const aliases = uniqueTexts(body.aliases);
  let intervalMinutes: number | null = null;
  let times: string[] = [];
  if (spawnType === "interval") {
    intervalMinutes = Number(body.intervalMinutes);
    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
      throw new Error("일반젠 보스의 젠 주기를 분 단위로 입력해주세요.");
    }
  } else {
    times = fixedTimes(body.fixedTimes);
    if (!times.length) throw new Error("고정젠 시간을 하나 이상 입력해주세요.");
  }

  const requestedSort = Number(body.sortOrder ?? 0);
  return {
    name,
    aliases,
    level,
    spawn_type: spawnType,
    interval_minutes: intervalMinutes,
    fixed_times: times,
    enabled: body.enabled === false ? false : true,
    sort_order: Number.isInteger(requestedSort) ? requestedSort : 0,
    description: text(body.description),
  };
}

async function saveState(bossId: string, nextSpawnAt: string | null, actorDiscordId: string) {
  if (!nextSpawnAt) return;
  const { error } = await supabaseAdmin.from("boss_timer_states").upsert({
    boss_id: bossId,
    guild_id: adminGuildId(),
    next_spawn_at: nextSpawnAt,
    source: "manual",
    updated_by_discord_id: actorDiscordId || null,
  }, { onConflict: "boss_id,guild_id" });
  if (error) throw error;
}

function actorInfo(session: any) {
  return {
    actorDiscordId: String(session.user.discordId || ""),
    actorName: session.user.name || "관리자",
    actorRole: session.user.isMaster ? "MASTER" as const : "ADMIN" as const,
  };
}

async function writeBossEvent(values: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("boss_timer_events").insert({
    guild_id: adminGuildId(),
    ...values,
  });
  if (error) throw error;
}

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok) return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    return NextResponse.json({ success: true, guildId: adminGuildId(), bosses: await getAllBosses() });
  } catch (error) {
    console.error("[ADMIN BOSS TIMES GET]", error);
    return NextResponse.json({ success: false, message: "보스 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok || !authResult.session) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    }
    const body = await request.json();
    const payload = buildBossPayload(body);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("boss_timers").select("id").eq("name", payload.name).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ success: false, message: "같은 이름의 보스가 이미 있습니다." }, { status: 409 });

    const { data: boss, error } = await supabaseAdmin.from("boss_timers").insert({
      ...payload,
      created_by_discord_id: String(authResult.session.user.discordId || "") || null,
    }).select("*").single();
    if (error) throw error;

    const nextSpawnAt = nullableIsoDate(body.nextSpawnAt);
    await saveState(boss.id, nextSpawnAt, String(authResult.session.user.discordId || ""));
    await writeBossEvent({
      boss_id: boss.id,
      boss_name_snapshot: boss.name,
      event_type: "create",
      occurred_at: new Date().toISOString(),
      next_spawn_at: nextSpawnAt,
      source: "manual",
      actor_discord_id: String(authResult.session.user.discordId || "") || null,
    });

    const actor = actorInfo(authResult.session);
    const audit = await writeAuditLog({
      action: "CREATE", targetType: "boss_timer", targetId: boss.id, targetName: boss.name,
      ...actor, beforeData: null, afterData: { ...payload, nextSpawnAt, guildId: adminGuildId() },
      description: `${boss.name} 보스 등록`,
    });

    return NextResponse.json({ success: true, message: "보스를 등록했습니다.", bossId: boss.id, auditSaved: audit.success, auditWarning: audit.success ? null : audit.message });
  } catch (error) {
    console.error("[ADMIN BOSS TIMES POST]", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "보스 등록 중 오류가 발생했습니다." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok || !authResult.session) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    }
    const body = await request.json();
    const id = text(body.id);
    if (!id) return NextResponse.json({ success: false, message: "수정할 보스 ID가 없습니다." }, { status: 400 });

    const before = await getBoss(id);
    if (!before) return NextResponse.json({ success: false, message: "수정할 보스를 찾지 못했습니다." }, { status: 404 });

    if (text(body.action) === "restore") {
      const { error } = await supabaseAdmin.from("boss_timers").update({ enabled: true }).eq("id", id);
      if (error) throw error;
      await writeBossEvent({
        boss_id: id, boss_name_snapshot: before.name, event_type: "update",
        occurred_at: new Date().toISOString(), source: "manual",
        actor_discord_id: String(authResult.session.user.discordId || "") || null,
      });
      const audit = await writeAuditLog({
        action: "UPDATE", targetType: "boss_timer", targetId: id, targetName: before.name,
        ...actorInfo(authResult.session), beforeData: before, afterData: { ...before, enabled: true, guildId: adminGuildId() },
        description: `${before.name} 보스 다시 활성화`,
      });
      return NextResponse.json({ success: true, message: "보스를 다시 활성화했습니다. 밍봇에도 자동 반영됩니다.", auditSaved: audit.success, auditWarning: audit.success ? null : audit.message });
    }

    const payload = buildBossPayload(body);
    const { data: sameName, error: sameNameError } = await supabaseAdmin
      .from("boss_timers").select("id").eq("name", payload.name).neq("id", id).maybeSingle();
    if (sameNameError) throw sameNameError;
    if (sameName) return NextResponse.json({ success: false, message: "같은 이름의 다른 보스가 이미 있습니다." }, { status: 409 });

    const { error } = await supabaseAdmin.from("boss_timers").update(payload).eq("id", id);
    if (error) throw error;

    const nextSpawnAt = nullableIsoDate(body.nextSpawnAt);
    if (nextSpawnAt) {
      await saveState(id, nextSpawnAt, String(authResult.session.user.discordId || ""));
      await writeBossEvent({
        boss_id: id, boss_name_snapshot: payload.name, event_type: "manual_update",
        occurred_at: new Date().toISOString(), next_spawn_at: nextSpawnAt, source: "manual",
        actor_discord_id: String(authResult.session.user.discordId || "") || null,
      });
    }

    const audit = await writeAuditLog({
      action: "UPDATE", targetType: "boss_timer", targetId: id, targetName: payload.name,
      ...actorInfo(authResult.session), beforeData: before,
      afterData: { ...payload, nextSpawnAt, guildId: adminGuildId() },
      description: `${payload.name} 보스 정보 수정`,
    });
    return NextResponse.json({ success: true, message: "보스 정보를 수정했습니다.", auditSaved: audit.success, auditWarning: audit.success ? null : audit.message });
  } catch (error) {
    console.error("[ADMIN BOSS TIMES PATCH]", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "보스 수정 중 오류가 발생했습니다." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (!authResult.ok || !authResult.session) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    }
    const body = await request.json();
    const id = text(body.id);
    if (!id) return NextResponse.json({ success: false, message: "삭제할 보스 ID가 없습니다." }, { status: 400 });

    const before = await getBoss(id);
    if (!before) return NextResponse.json({ success: false, message: "삭제할 보스를 찾지 못했습니다." }, { status: 404 });

    const { error } = await supabaseAdmin.from("boss_timers").update({ enabled: false }).eq("id", id);
    if (error) throw error;

    const { error: stateError } = await supabaseAdmin
      .from("boss_timer_states")
      .delete()
      .eq("boss_id", id)
      .eq("guild_id", adminGuildId());
    if (stateError) throw stateError;

    await writeBossEvent({
      boss_id: id, boss_name_snapshot: before.name, event_type: "delete",
      occurred_at: new Date().toISOString(), source: "manual",
      actor_discord_id: String(authResult.session.user.discordId || "") || null,
    });

    const audit = await writeAuditLog({
      action: "DELETE", targetType: "boss_timer", targetId: id, targetName: before.name,
      ...actorInfo(authResult.session), beforeData: before, afterData: null,
      description: `${before.name} 보스 비활성화`,
    });
    return NextResponse.json({ success: true, message: "보스를 비활성화했습니다. 밍봇에도 자동 반영됩니다.", auditSaved: audit.success, auditWarning: audit.success ? null : audit.message });
  } catch (error) {
    console.error("[ADMIN BOSS TIMES DELETE]", error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "보스 삭제 중 오류가 발생했습니다." }, { status: 400 });
  }
}
