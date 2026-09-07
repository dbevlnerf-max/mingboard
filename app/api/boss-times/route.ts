import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


type BossTimerRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  level: number | null;
  spawn_type: "interval" | "fixed";
  interval_minutes: number | null;
  fixed_times: string[] | null;
  enabled: boolean;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};


type BossStateRow = {
  boss_id: string;
  last_spawn_at: string | null;
  next_spawn_at: string | null;
  source: "manual" | "mingbot" | "system";
  external_event_id: string | null;
  updated_by_discord_id: string | null;
  updated_at: string;
};


function normalizeFixedTimes(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }


  return value
    .map(
      item =>
        String(
          item || ""
        ).trim()
    )
    .filter(
      Boolean
    );
}


export async function GET() {

  try {

    // =====================================================
    // 로그인 / 길드 접근 권한 확인
    // =====================================================

    const session =
      await auth();


    if (
      !session?.user
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }


    const user =
      session.user;


    const canAccess =
      Boolean(
        (
          user.isGuildMember &&
          user.hasZeusRole
        ) ||
        user.isAdmin ||
        user.isMaster
      );


    if (
      !canAccess
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "보스타임을 조회할 권한이 없습니다.",
        },
        {
          status: 403,
        }
      );
    }


    // =====================================================
    // 보스 기본정보
    // =====================================================

    const {
      data:
        bossRows,
      error:
        bossError,
    } =
      await supabaseAdmin
        .from(
          "boss_timers"
        )
        .select(
          [
            "id",
            "name",
            "aliases",
            "level",
            "spawn_type",
            "interval_minutes",
            "fixed_times",
            "enabled",
            "sort_order",
            "description",
            "created_at",
            "updated_at",
          ].join(",")
        )
        .eq(
          "enabled",
          true
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

      console.error(
        "[BOSS TIMES] boss_timers 조회 오류:",
        bossError
      );


      return NextResponse.json(
        {
          success: false,
          message:
            "보스 목록을 불러오지 못했습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const bosses =
      (
        bossRows ||
        []
      ) as unknown as
      BossTimerRow[];


    // =====================================================
    // 현재 보스타임 상태
    // =====================================================

    const bossIds =
      bosses.map(
        boss =>
          boss.id
      );


    let states:
      BossStateRow[] =
        [];


    if (
      bossIds.length >
      0
    ) {

      const {
        data:
          stateRows,
        error:
          stateError,
      } =
        await supabaseAdmin
          .from(
            "boss_timer_states"
          )
          .select(
            [
              "boss_id",
              "last_spawn_at",
              "next_spawn_at",
              "source",
              "external_event_id",
              "updated_by_discord_id",
              "updated_at",
            ].join(",")
          )
          .in(
            "boss_id",
            bossIds
          );


      if (
        stateError
      ) {

        console.error(
          "[BOSS TIMES] boss_timer_states 조회 오류:",
          stateError
        );


        return NextResponse.json(
          {
            success: false,
            message:
              "보스타임 상태를 불러오지 못했습니다.",
          },
          {
            status: 500,
          }
        );
      }


      states =
        (
          stateRows ||
          []
        ) as unknown as
        BossStateRow[];
    }


    const stateMap =
      new Map<
        string,
        BossStateRow
      >();


    for (
      const state of
      states
    ) {

      stateMap.set(
        state.boss_id,
        state
      );
    }


    // =====================================================
    // 화면용 데이터 조합
    // =====================================================

    const result =
      bosses.map(
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

            aliases:
              Array.isArray(
                boss.aliases
              )
                ? boss.aliases
                : [],

            level:
              boss.level,

            spawnType:
              boss.spawn_type,

            intervalMinutes:
              boss.interval_minutes,

            fixedTimes:
              normalizeFixedTimes(
                boss.fixed_times
              ),

            description:
              boss.description ||
              "",

            sortOrder:
              boss.sort_order,

            lastSpawnAt:
              state
                ?.last_spawn_at ||
              null,

            nextSpawnAt:
              state
                ?.next_spawn_at ||
              null,

            stateSource:
              state
                ?.source ||
              null,

            stateUpdatedAt:
              state
                ?.updated_at ||
              null,
          };
        }
      );


    return NextResponse.json(
      {
        success: true,

        count:
          result.length,

        bosses:
          result,
      },
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
      "[BOSS TIMES] GET ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "보스타임 조회 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
