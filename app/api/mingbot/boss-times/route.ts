import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type BossSpawnType = "interval" | "fixed";

function unauthorized() {
  return NextResponse.json({ success: false, message: "밍봇 API 인증에 실패했습니다." }, { status: 401 });
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanAliases(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(cleanText).filter(Boolean)));
}

function cleanFixedTimes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(cleanText)
        .filter(item => /^([01]\d|2[0-3]):[0-5]\d$/.test(item))
    )
  ).sort();
}

function parseNullableLevel(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) return undefined;
  return parsed === 0 ? null : parsed;
}

function getGuildId(body: Record<string, unknown>) {
  return cleanText(body.guildId || body.guild_id);
}

async function findBoss(guildId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from("boss_timers")
    .select("*")
    .eq("guild_id", guildId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertBoss(body: Record<string, unknown>) {
  const guildId = getGuildId(body);
  const name = cleanText(body.name);
  if (!guildId) return { ok: false, status: 400, message: "guildId가 없습니다." };
  if (!name) return { ok: false, status: 400, message: "보스 이름이 없습니다." };

  const spawnType = cleanText(body.spawnType) as BossSpawnType;
  if (spawnType !== "interval" && spawnType !== "fixed") {
    return { ok: false, status: 400, message: "spawnType은 interval 또는 fixed여야 합니다." };
  }

  const level = parseNullableLevel(body.level);
  if (level === undefined) return { ok: false, status: 400, message: "보스 레벨이 올바르지 않습니다." };

  const existing = await findBoss(guildId, name);
  const aliases = Array.isArray(body.aliases)
    ? cleanAliases(body.aliases)
    : Array.isArray(existing?.aliases) ? existing.aliases : [];

  let intervalMinutes: number | null = null;
  let fixedTimes: string[] = [];

  if (spawnType === "interval") {
    intervalMinutes = Number(body.intervalMinutes);
    if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
      return { ok: false, status: 400, message: "일반젠 보스의 소환주기가 올바르지 않습니다." };
    }
  } else {
    fixedTimes = cleanFixedTimes(body.fixedTimes);
    if (!fixedTimes.length) {
      return { ok: false, status: 400, message: "고정젠 보스의 출현시간이 없습니다." };
    }
  }

  const requestedSortOrder = Number(body.sortOrder);
  const sortOrder = Number.isInteger(requestedSortOrder)
    ? requestedSortOrder
    : Number(existing?.sort_order ?? 0);

  const payload = {
    guild_id: guildId,
    name,
    aliases,
    level,
    spawn_type: spawnType,
    interval_minutes: intervalMinutes,
    fixed_times: fixedTimes,
    enabled: true,
    sort_order: sortOrder,
    description: cleanText(body.description) || existing?.description || "",
  };

  const { data: boss, error } = await supabaseAdmin
    .from("boss_timers")
    .upsert(payload, { onConflict: "guild_id,name" })
    .select("*")
    .single();
  if (error) throw error;

  const nextSpawnAt = cleanText(body.nextSpawnAt);
  if (nextSpawnAt) {
    const { error: stateError } = await supabaseAdmin
      .from("boss_timer_states")
      .upsert({
        boss_id: boss.id,
        last_spawn_at: null,
        next_spawn_at: nextSpawnAt,
        source: "mingbot",
        external_event_id: null,
        updated_by_discord_id: cleanText(body.actorDiscordId) || null,
      }, { onConflict: "boss_id" });
    if (stateError) throw stateError;
  }

  return {
    ok: true,
    status: 200,
    data: {
      success: true,
      created: !existing,
      boss: {
        id: boss.id,
        guildId: boss.guild_id,
        name: boss.name,
        spawnType: boss.spawn_type,
        intervalMinutes: boss.interval_minutes,
        fixedTimes: boss.fixed_times,
        enabled: boss.enabled,
      },
    },
  };
}

async function disableBoss(body: Record<string, unknown>) {
  const guildId = getGuildId(body);
  const name = cleanText(body.name);
  if (!guildId) return { ok: false, status: 400, message: "guildId가 없습니다." };
  if (!name) return { ok: false, status: 400, message: "삭제할 보스 이름이 없습니다." };

  const boss = await findBoss(guildId, name);
  if (!boss) {
    return { ok: true, status: 200, data: { success: true, alreadyDisabled: true, guildId, name } };
  }

  const { error } = await supabaseAdmin.from("boss_timers").update({ enabled: false }).eq("id", boss.id);
  if (error) throw error;

  const { error: stateError } = await supabaseAdmin.from("boss_timer_states").delete().eq("boss_id", boss.id);
  if (stateError) throw stateError;

  return { ok: true, status: 200, data: { success: true, alreadyDisabled: false, guildId, name } };
}

async function updateBossState(body: Record<string, unknown>) {
  const guildId = getGuildId(body);
  const name = cleanText(body.name);
  const occurredAt = cleanText(body.occurredAt);
  const nextSpawnAt = cleanText(body.nextSpawnAt);
  const externalEventId = cleanText(body.externalEventId);

  if (!guildId || !name || !occurredAt || !nextSpawnAt || !externalEventId) {
    return { ok: false, status: 400, message: "보스타임 갱신 정보가 부족합니다." };
  }

  let boss = await findBoss(guildId, name);
  if (!boss) {
    const upsertResult = await upsertBoss(body);
    if (!upsertResult.ok) return upsertResult;
    boss = await findBoss(guildId, name);
  }
  if (!boss) return { ok: false, status: 500, message: "보스 자동 등록 후 정보를 찾지 못했습니다." };

  const { data: currentState, error: currentStateError } = await supabaseAdmin
    .from("boss_timer_states")
    .select("next_spawn_at")
    .eq("boss_id", boss.id)
    .maybeSingle();
  if (currentStateError) throw currentStateError;

  const currentNext = currentState?.next_spawn_at ? new Date(currentState.next_spawn_at).getTime() : null;
  const incomingNext = new Date(nextSpawnAt).getTime();

  // Older state must never overwrite a newer nextSpawnAt.
  if (currentNext !== null && Number.isFinite(incomingNext) && incomingNext < currentNext) {
    return {
      ok: true,
      status: 200,
      data: { success: true, ignoredAsStale: true, guildId, name, currentNextSpawnAt: currentState.next_spawn_at },
    };
  }

  const { error: stateError } = await supabaseAdmin
    .from("boss_timer_states")
    .upsert({
      boss_id: boss.id,
      last_spawn_at: occurredAt,
      next_spawn_at: nextSpawnAt,
      source: "mingbot",
      external_event_id: externalEventId,
      updated_by_discord_id: cleanText(body.actorDiscordId) || null,
    }, { onConflict: "boss_id" });
  if (stateError) throw stateError;

  const { error: eventError } = await supabaseAdmin.from("boss_timer_events").insert({
    boss_id: boss.id,
    boss_name_snapshot: boss.name,
    event_type: cleanText(body.eventType) || "cut",
    occurred_at: occurredAt,
    next_spawn_at: nextSpawnAt,
    source: "mingbot",
    external_event_id: externalEventId,
    actor_discord_id: cleanText(body.actorDiscordId) || null,
  });
  if (eventError && !String(eventError.message || "").toLowerCase().includes("duplicate")) throw eventError;

  return { ok: true, status: 200, data: { success: true, guildId, name, nextSpawnAt } };
}

function verifySecret(request: NextRequest) {
  const expectedSecret = process.env.MINGBOT_API_SECRET?.trim();
  const receivedSecret = request.headers.get("x-mingbot-secret")?.trim();
  return Boolean(expectedSecret && receivedSecret && receivedSecret === expectedSecret);
}

export async function GET(request: NextRequest) {
  try {
    if (!verifySecret(request)) return unauthorized();

    const requestedGuildId = cleanText(request.nextUrl.searchParams.get("guildId"));
    let query = supabaseAdmin
      .from("boss_timers")
      .select("id,guild_id,name,level,spawn_type,interval_minutes,fixed_times,enabled,sort_order,updated_at")
      .neq("guild_id", "legacy")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (requestedGuildId) query = query.eq("guild_id", requestedGuildId);

    const { data: bosses, error: bossError } = await query;
    if (bossError) throw bossError;

    const ids = (bosses || []).map(boss => boss.id);
    let states: any[] = [];
    if (ids.length) {
      const { data, error } = await supabaseAdmin
        .from("boss_timer_states")
        .select("boss_id,last_spawn_at,next_spawn_at,updated_at")
        .in("boss_id", ids);
      if (error) throw error;
      states = data || [];
    }

    const stateMap = new Map(states.map(state => [state.boss_id, state]));
    return NextResponse.json({
      success: true,
      bosses: (bosses || []).map(boss => {
        const state = stateMap.get(boss.id);
        return {
          id: boss.id,
          guildId: boss.guild_id,
          name: boss.name,
          level: boss.level,
          spawnType: boss.spawn_type,
          intervalMinutes: boss.interval_minutes,
          fixedTimes: Array.isArray(boss.fixed_times) ? boss.fixed_times : [],
          enabled: boss.enabled,
          sortOrder: boss.sort_order,
          updatedAt: boss.updated_at,
          lastSpawnAt: state?.last_spawn_at || null,
          nextSpawnAt: state?.next_spawn_at || null,
          stateUpdatedAt: state?.updated_at || null,
        };
      }),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[MINGBOT BOSS TIMES] GET ERROR:", error);
    return NextResponse.json({ success: false, message: "밍봇 보스설정 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifySecret(request)) return unauthorized();
    const body = await request.json();
    const action = cleanText(body.action);

    let result;
    if (action === "upsert") result = await upsertBoss(body);
    else if (action === "delete") result = await disableBoss(body);
    else if (action === "state") result = await updateBossState(body);
    else return NextResponse.json({ success: false, message: "지원하지 않는 보스타임 작업입니다." }, { status: 400 });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: "message" in result ? result.message : "보스타임 동기화 요청을 처리하지 못했습니다." }, { status: result.status });
    }

    return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[MINGBOT BOSS TIMES] ERROR:", error);
    return NextResponse.json({ success: false, message: "밍봇 보스타임 동기화 중 오류가 발생했습니다." }, { status: 500 });
  }
}
