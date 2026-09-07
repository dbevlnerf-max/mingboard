import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


type BossSpawnType =
  | "interval"
  | "fixed";


function unauthorized() {
  return NextResponse.json(
    {
      success: false,
      message:
        "밍봇 API 인증에 실패했습니다.",
    },
    {
      status: 401,
    }
  );
}


function cleanText(
  value: unknown
) {
  return String(
    value ??
    ""
  ).trim();
}


function cleanAliases(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }


  return Array.from(
    new Set(
      value
        .map(
          item =>
            cleanText(
              item
            )
        )
        .filter(
          Boolean
        )
    )
  );
}


function cleanFixedTimes(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }


  const valid =
    value
      .map(
        item =>
          cleanText(
            item
          )
      )
      .filter(
        item =>
          /^([01]\d|2[0-3]):[0-5]\d$/.test(
            item
          )
      );


  return Array.from(
    new Set(
      valid
    )
  ).sort();
}


function parseNullableLevel(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 0 ||
    parsed > 999
  ) {
    return undefined;
  }


  return parsed === 0
    ? null
    : parsed;
}


async function findBossByName(
  name: string
) {

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "boss_timers"
      )
      .select(
        "*"
      )
      .eq(
        "name",
        name
      )
      .maybeSingle();


  if (
    error
  ) {
    throw error;
  }


  return data;
}


async function upsertBoss(
  body: Record<
    string,
    unknown
  >
) {

  const name =
    cleanText(
      body.name
    );


  if (
    !name
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "보스 이름이 없습니다.",
    };
  }


  const spawnType =
    cleanText(
      body.spawnType
    ) as BossSpawnType;


  if (
    spawnType !==
      "interval" &&
    spawnType !==
      "fixed"
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "spawnType은 interval 또는 fixed여야 합니다.",
    };
  }


  const level =
    parseNullableLevel(
      body.level
    );


  if (
    level === undefined
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "보스 레벨이 올바르지 않습니다.",
    };
  }


  const existing =
    await findBossByName(
      name
    );


  const aliasesProvided =
    Array.isArray(
      body.aliases
    );


  const aliases =
    aliasesProvided
      ? cleanAliases(
          body.aliases
        )
      : (
          Array.isArray(
            existing?.aliases
          )
            ? existing.aliases
            : []
        );


  let intervalMinutes:
    number |
    null =
      null;


  let fixedTimes:
    string[] =
      [];


  if (
    spawnType ===
    "interval"
  ) {

    intervalMinutes =
      Number(
        body.intervalMinutes
      );


    if (
      !Number.isInteger(
        intervalMinutes
      ) ||
      intervalMinutes <=
        0
    ) {
      return {
        ok: false,
        status: 400,
        message:
          "일반젠 보스의 소환주기가 올바르지 않습니다.",
      };
    }

  } else {

    fixedTimes =
      cleanFixedTimes(
        body.fixedTimes
      );


    if (
      fixedTimes.length ===
      0
    ) {
      return {
        ok: false,
        status: 400,
        message:
          "고정젠 보스의 출현시간이 없습니다.",
      };
    }
  }


  const requestedSortOrder =
    Number(
      body.sortOrder
    );


  const sortOrder =
    Number.isInteger(
      requestedSortOrder
    )
      ? requestedSortOrder
      : (
          Number(
            existing?.sort_order ??
            0
          )
        );


  const payload = {
    name,

    aliases,

    level,

    spawn_type:
      spawnType,

    interval_minutes:
      intervalMinutes,

    fixed_times:
      fixedTimes,

    enabled:
      true,

    sort_order:
      sortOrder,

    description:
      cleanText(
        body.description
      ) ||
      (
        existing
          ?.description ||
        ""
      ),
  };


  const {
    data:
      boss,
    error,
  } =
    await supabaseAdmin
      .from(
        "boss_timers"
      )
      .upsert(
        payload,
        {
          onConflict:
            "name",
        }
      )
      .select(
        "*"
      )
      .single();


  if (
    error
  ) {
    throw error;
  }


  const nextSpawnAt =
    cleanText(
      body.nextSpawnAt
    );


  if (
    nextSpawnAt
  ) {

    const {
      error:
        stateError,
    } =
      await supabaseAdmin
        .from(
          "boss_timer_states"
        )
        .upsert(
          {
            boss_id:
              boss.id,

            last_spawn_at:
              null,

            next_spawn_at:
              nextSpawnAt,

            source:
              "mingbot",

            external_event_id:
              null,

            updated_by_discord_id:
              cleanText(
                body.actorDiscordId
              ) ||
              null,
          },
          {
            onConflict:
              "boss_id",
          }
        );


    if (
      stateError
    ) {
      throw stateError;
    }
  }


  return {
    ok: true,
    status: 200,

    data: {
      success: true,

      created:
        !existing,

      boss: {
        id:
          boss.id,

        name:
          boss.name,

        spawnType:
          boss.spawn_type,

        intervalMinutes:
          boss.interval_minutes,

        fixedTimes:
          boss.fixed_times,

        enabled:
          boss.enabled,
      },
    },
  };
}


async function disableBoss(
  body: Record<
    string,
    unknown
  >
) {

  const name =
    cleanText(
      body.name
    );


  if (
    !name
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "삭제할 보스 이름이 없습니다.",
    };
  }


  const boss =
    await findBossByName(
      name
    );


  if (
    !boss
  ) {

    // 밍봇 재시도 시 이미 삭제된 상태라면 성공으로 처리
    return {
      ok: true,
      status: 200,

      data: {
        success: true,
        alreadyDisabled: true,
        name,
      },
    };
  }


  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "boss_timers"
      )
      .update({
        enabled: false,
      })
      .eq(
        "id",
        boss.id
      );


  if (
    error
  ) {
    throw error;
  }


  const {
    error:
      stateError,
  } =
    await supabaseAdmin
      .from(
        "boss_timer_states"
      )
      .delete()
      .eq(
        "boss_id",
        boss.id
      );


  if (
    stateError
  ) {
    throw stateError;
  }


  return {
    ok: true,
    status: 200,

    data: {
      success: true,
      alreadyDisabled: false,
      name,
    },
  };
}


async function updateBossState(
  body: Record<
    string,
    unknown
  >
) {

  const name =
    cleanText(
      body.name
    );


  const occurredAt =
    cleanText(
      body.occurredAt
    );


  const nextSpawnAt =
    cleanText(
      body.nextSpawnAt
    );


  const externalEventId =
    cleanText(
      body.externalEventId
    );


  if (
    !name ||
    !occurredAt ||
    !nextSpawnAt ||
    !externalEventId
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "보스타임 갱신 정보가 부족합니다.",
    };
  }


  let boss =
    await findBossByName(
      name
    );


  // 기존 밍봇 DB에는 있지만 Supabase에 아직 없는 보스라면
  // 로컬 설정값을 이용하여 자동 등록 후 상태를 기록합니다.
  if (
    !boss
  ) {

    const upsertResult =
      await upsertBoss(
        body
      );


    if (
      !upsertResult.ok
    ) {
      return upsertResult;
    }


    boss =
      await findBossByName(
        name
      );
  }


  if (
    !boss
  ) {
    return {
      ok: false,
      status: 500,
      message:
        "보스 자동 등록 후 정보를 찾지 못했습니다.",
    };
  }


  const {
    data:
      rpcResult,
    error:
      rpcError,
  } =
    await supabaseAdmin
      .rpc(
        "record_boss_timer_event",
        {
          p_boss_id:
            boss.id,

          p_occurred_at:
            occurredAt,

          p_next_spawn_at:
            nextSpawnAt,

          p_source:
            "mingbot",

          p_external_event_id:
            externalEventId,

          p_actor_discord_id:
            cleanText(
              body.actorDiscordId
            ) ||
            null,

          p_event_type:
            cleanText(
              body.eventType
            ) ||
            "cut",
        }
      );


  if (
    rpcError
  ) {
    throw rpcError;
  }


  return {
    ok: true,
    status: 200,

    data:
      rpcResult,
  };
}



export async function GET(
  request: NextRequest
) {

  try {

    const expectedSecret =
      process.env
        .MINGBOT_API_SECRET
        ?.trim();


    const receivedSecret =
      request.headers
        .get(
          "x-mingbot-secret"
        )
        ?.trim();


    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      return unauthorized();
    }


    const {
      data:
        bosses,
      error:
        bossError,
    } =
      await supabaseAdmin
        .from(
          "boss_timers"
        )
        .select(
          "id,name,level,spawn_type,interval_minutes,fixed_times,enabled,sort_order,updated_at"
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
        .order(
          "name",
          {
            ascending: true,
          }
        );


    if (
      bossError
    ) {
      throw bossError;
    }


    const ids =
      (
        bosses ||
        []
      ).map(
        boss =>
          boss.id
      );


    let states: any[] =
      [];


    if (
      ids.length >
      0
    ) {

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "boss_timer_states"
          )
          .select(
            "boss_id,last_spawn_at,next_spawn_at,updated_at"
          )
          .in(
            "boss_id",
            ids
          );


      if (
        error
      ) {
        throw error;
      }


      states =
        data ||
        [];
    }


    const stateMap =
      new Map(
        states.map(
          state => [
            state.boss_id,
            state,
          ]
        )
      );


    return NextResponse.json({
      success: true,

      bosses:
        (
          bosses ||
          []
        ).map(
          boss => {

            const state =
              stateMap.get(
                boss.id
              );

            return {
              id:
                boss.id,

              name:
                boss.name,

              level:
                boss.level,

              spawnType:
                boss.spawn_type,

              intervalMinutes:
                boss.interval_minutes,

              fixedTimes:
                Array.isArray(
                  boss.fixed_times
                )
                  ? boss.fixed_times
                  : [],

              enabled:
                boss.enabled,

              sortOrder:
                boss.sort_order,

              updatedAt:
                boss.updated_at,

              lastSpawnAt:
                state
                  ?.last_spawn_at ||
                null,

              nextSpawnAt:
                state
                  ?.next_spawn_at ||
                null,

              stateUpdatedAt:
                state
                  ?.updated_at ||
                null,
            };
          }
        ),
    });


  } catch (
    error
  ) {

    console.error(
      "[MINGBOT BOSS TIMES] GET ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "밍봇 보스설정 조회 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


export async function POST(
  request: NextRequest
) {

  try {

    // =====================================================
    // 밍봇 전용 인증
    // =====================================================

    const expectedSecret =
      process.env
        .MINGBOT_API_SECRET
        ?.trim();


    const receivedSecret =
      request.headers
        .get(
          "x-mingbot-secret"
        )
        ?.trim();


    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {
      return unauthorized();
    }


    const body =
      await request.json();


    const action =
      cleanText(
        body.action
      );


    let result;


    if (
      action ===
      "upsert"
    ) {

      result =
        await upsertBoss(
          body
        );

    } else if (
      action ===
      "delete"
    ) {

      result =
        await disableBoss(
          body
        );

    } else if (
      action ===
      "state"
    ) {

      result =
        await updateBossState(
          body
        );

    } else {

      return NextResponse.json(
        {
          success: false,
          message:
            "지원하지 않는 보스타임 작업입니다.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !result.ok
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            (
              "message" in result
                ? result.message
                : "보스타임 동기화 요청을 처리하지 못했습니다."
            ),
        },
        {
          status:
            result.status,
        }
      );
    }


    return NextResponse.json(
      result.data,
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );


  } catch (
    error
  ) {

    console.error(
      "[MINGBOT BOSS TIMES] ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "밍봇 보스타임 동기화 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
