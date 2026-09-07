import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


// ============================================================
// KST MONTH RANGE
//
// 예:
// 2026-09
//
// 시작:
// 2026-09-01 00:00 KST
//
// 종료:
// 2026-10-01 00:00 KST
//
// DB 조회용 UTC:
// KST - 9시간
// ============================================================

function getKstMonthRange(
  monthText?: string | null
) {

  const now =
    new Date();


  let year:
    number;


  let month:
    number;


  if (
    monthText &&
    /^\d{4}-\d{2}$/.test(
      monthText
    )
  ) {

    const parts =
      monthText
        .split("-")
        .map(
          Number
        );


    year =
      parts[0];


    month =
      parts[1];

  } else {

    const kstNow =
      new Date(
        now.getTime() +
        9 *
        60 *
        60 *
        1000
      );


    year =
      kstNow
        .getUTCFullYear();


    month =
      kstNow
        .getUTCMonth() +
      1;
  }


  const startUtc =
    new Date(
      Date.UTC(
        year,
        month - 1,
        1,
        -9,
        0,
        0,
        0
      )
    );


  const endUtc =
    new Date(
      Date.UTC(
        year,
        month,
        1,
        -9,
        0,
        0,
        0
      )
    );


  return {

    month:
      `${year}-${String(
        month
      ).padStart(
        2,
        "0"
      )}`,

    start:
      startUtc
        .toISOString(),

    end:
      endUtc
        .toISOString(),
  };
}


// ============================================================
// AUTH
// ============================================================

async function checkAccess() {

  const session =
    await auth();


  if (
    !session?.user
  ) {

    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success:
              false,

            message:
              "로그인이 필요합니다.",
          },
          {
            status:
              401,
          }
        ),
    };
  }


  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {

    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success:
              false,

            message:
              "길드 인증이 필요합니다.",
          },
          {
            status:
              403,
          }
        ),
    };
  }


  return {
    ok: true as const,
    session,
  };
}


// ============================================================
// GET
//
// mode=week
// mode=month
// mode=detail
// ============================================================

export async function GET(
  request: NextRequest
) {

  const access =
    await checkAccess();


  if (
    !access.ok
  ) {

    return access.response;
  }


  const searchParams =
    request
      .nextUrl
      .searchParams;


  const mode =
    searchParams.get(
      "mode"
    ) ||
    "week";


  try {

    // ========================================================
    // WEEK
    // ========================================================

    if (
      mode ===
      "week"
    ) {

      const requestedPeriodId =
        searchParams.get(
          "period"
        );


      let period:
        any =
        null;


      if (
        requestedPeriodId
      ) {

        const {
          data,
          error,
        } =
          await supabaseAdmin
            .from(
              "participation_periods"
            )
            .select(
              "id,name,start_at,end_at,status,closed_at"
            )
            .eq(
              "id",
              requestedPeriodId
            )
            .maybeSingle();


        if (
          error
        ) {

          throw error;
        }


        period =
          data;

      } else {

        const {
          data,
          error,
        } =
          await supabaseAdmin
            .from(
              "participation_periods"
            )
            .select(
              "id,name,start_at,end_at,status,closed_at"
            )
            .order(
              "start_at",
              {
                ascending:
                  false,
              }
            )
            .limit(
              1
            )
            .maybeSingle();


        if (
          error
        ) {

          throw error;
        }


        period =
          data;
      }


      if (
        !period
      ) {

        return NextResponse.json({

          success:
            true,

          mode:
            "week",

          period:
            null,

          targetCount:
            0,

          rows:
            [],
        });
      }


      // ------------------------------------------------------
      // 마감된 기간
      // 이미 저장된 스냅샷 사용
      // 재계산 X
      // ------------------------------------------------------

      if (
        period.status ===
        "closed"
      ) {

        const {
          data:
            summaries,

          error,
        } =
          await supabaseAdmin
            .from(
              "participation_period_summaries"
            )
            .select(
              `
              discord_id,
              nickname,
              guild,
              participation_count,
              target_count,
              base_score,
              adjustment_score,
              final_score,
              participation_rate,
              distribution_rate,
              total_distribution,
              distribution_amount,
              rank
              `
            )
            .eq(
              "period_id",
              period.id
            )
            .order(
              "rank",
              {
                ascending:
                  true,
              }
            );


        if (
          error
        ) {

          throw error;
        }


        return NextResponse.json({

          success:
            true,

          mode:
            "week",

          period,

          closed:
            true,

          targetCount:
            summaries?.[0]
              ?.target_count ||
            0,

          totalDistribution:
            summaries?.[0]
              ?.total_distribution ||
            0,

          rows:
            summaries ||
            [],
        });
      }


      // ------------------------------------------------------
      // 진행중 주간
      //
      // Supabase RPC 1회로
      // 참여횟수 / 점수 / 참여율 집계
      // ------------------------------------------------------

      const {
        data:
          rows,

        error:
          rpcError,
      } =
        await supabaseAdmin
          .rpc(
            "get_period_participation_summary",
            {
              p_period_id:
                period.id,
            }
          );


      if (
        rpcError
      ) {

        throw rpcError;
      }


      const normalizedRows =
        (
          rows ||
          []
        ).map(
          (
            row:
              any,
            index:
              number
          ) => ({

            discordId:
              row.discord_id,

            nickname:
              row.nickname,

            guild:
              row.guild,

            participationCount:
              Number(
                row.participation_count ||
                0
              ),

            targetCount:
              Number(
                row.target_count ||
                0
              ),

            baseScore:
              Number(
                row.base_score ||
                0
              ),

            adjustmentScore:
              Number(
                row.adjustment_score ||
                0
              ),

            finalScore:
              Number(
                row.final_score ||
                0
              ),

            participationRate:
              Number(
                row.participation_rate ||
                0
              ),

            rank:
              index +
              1,
          })
        );


      return NextResponse.json({

        success:
          true,

        mode:
          "week",

        period,

        closed:
          false,

        targetCount:
          normalizedRows?.[0]
            ?.targetCount ||
          0,

        rows:
          normalizedRows,
      });
    }


    // ========================================================
    // MONTH
    //
    // KST 1일 00:00 기준
    // ========================================================

    if (
      mode ===
      "month"
    ) {

      const range =
        getKstMonthRange(
          searchParams.get(
            "month"
          )
        );


      const {
        data:
          rows,

        error:
          rpcError,
      } =
        await supabaseAdmin
          .rpc(
            "get_monthly_participation_summary",
            {
              p_start:
                range.start,

              p_end:
                range.end,
            }
          );


      if (
        rpcError
      ) {

        throw rpcError;
      }


      const normalizedRows =
        (
          rows ||
          []
        ).map(
          (
            row:
              any,
            index:
              number
          ) => ({

            discordId:
              row.discord_id,

            nickname:
              row.nickname,

            guild:
              row.guild,

            participationCount:
              Number(
                row.participation_count ||
                0
              ),

            targetCount:
              Number(
                row.target_count ||
                0
              ),

            finalScore:
              Number(
                row.total_score ||
                0
              ),

            participationRate:
              Number(
                row.participation_rate ||
                0
              ),

            rank:
              index +
              1,
          })
        );


      return NextResponse.json({

        success:
          true,

        mode:
          "month",

        month:
          range.month,

        targetCount:
          normalizedRows?.[0]
            ?.targetCount ||
          0,

        rows:
          normalizedRows,
      });
    }


    // ========================================================
    // DETAIL
    //
    // 닉네임 클릭했을 때만 호출
    //
    // 예:
    // /api/participation
    // ?mode=detail
    // &discordId=123
    // &start=...
    // &end=...
    // ========================================================

    if (
      mode ===
      "detail"
    ) {

      const discordId =
        searchParams.get(
          "discordId"
        );


      const start =
        searchParams.get(
          "start"
        );


      const end =
        searchParams.get(
          "end"
        );


      if (
        !discordId ||
        !start ||
        !end
      ) {

        return NextResponse.json(
          {
            success:
              false,

            message:
              "상세조회 조건이 부족합니다.",
          },
          {
            status:
              400,
          }
        );
      }


      const {
        data:
          details,

        error:
          detailError,
      } =
        await supabaseAdmin
          .rpc(
            "get_user_participation_details",
            {
              p_discord_id:
                discordId,

              p_start:
                start,

              p_end:
                end,
            }
          );


      if (
        detailError
      ) {

        throw detailError;
      }


      return NextResponse.json({

        success:
          true,

        mode:
          "detail",

        rows:
          (
            details ||
            []
          ).map(
            (
              row:
                any
            ) => ({

              eventId:
                row.event_id,

              eventType:
                row.event_type,

              eventName:
                row.event_name,

              description:
                row.event_description,

              occurredAt:
                row.occurred_at,

              attended:
                Boolean(
                  row.attended
                ),

              score:
                Number(
                  row.score ||
                  0
                ),

              checkedAt:
                row.checked_at,
            })
          ),
      });
    }


    return NextResponse.json(
      {
        success:
          false,

        message:
          "지원하지 않는 조회 방식입니다.",
      },
      {
        status:
          400,
      }
    );


  } catch (
    error
  ) {

    console.error(
      "PARTICIPATION API ERROR:",
      error
    );


    return NextResponse.json(
      {
        success:
          false,

        message:
          error instanceof Error
            ? error.message
            : "참여점수 조회 중 오류가 발생했습니다.",
      },
      {
        status:
          500,
      }
    );
  }
}