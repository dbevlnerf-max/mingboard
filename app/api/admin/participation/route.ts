import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";


// ============================================================
// 관리자 권한
// ============================================================

async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const isAdmin =
    Boolean(session.user.isAdmin) ||
    Boolean(session.user.isMaster);

  if (!isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
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
// KST 날짜 처리
//
// 화면:
// 2026-09-07 ~ 2026-09-13
//
// DB:
// 09/07 00:00 KST
// ~
// 09/14 00:00 KST
//
// end_at은 exclusive
// ============================================================

function kstStartOfDay(dateText: string) {
  return new Date(
    `${dateText}T00:00:00+09:00`
  ).toISOString();
}


function kstNextDay(dateText: string) {
  const date = new Date(
    `${dateText}T00:00:00+09:00`
  );

  date.setUTCDate(
    date.getUTCDate() + 1
  );

  return date.toISOString();
}


// ============================================================
// 입력 검증
// ============================================================

function validatePeriodInput(
  name: unknown,
  startDate: unknown,
  endDate: unknown
) {
  const cleanName =
    String(name || "").trim();

  const cleanStartDate =
    String(startDate || "").trim();

  const cleanEndDate =
    String(endDate || "").trim();


  if (!cleanName) {
    return {
      ok: false as const,
      message: "집계 이름을 입력해주세요.",
    };
  }


  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;


  if (
    !datePattern.test(cleanStartDate) ||
    !datePattern.test(cleanEndDate)
  ) {
    return {
      ok: false as const,
      message: "시작일과 종료일을 올바르게 입력해주세요.",
    };
  }


  const start =
    new Date(
      `${cleanStartDate}T00:00:00+09:00`
    );

  const end =
    new Date(
      `${cleanEndDate}T00:00:00+09:00`
    );


  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return {
      ok: false as const,
      message: "올바르지 않은 날짜입니다.",
    };
  }


  if (end < start) {
    return {
      ok: false as const,
      message: "종료일은 시작일보다 빠를 수 없습니다.",
    };
  }


  return {
    ok: true as const,

    name: cleanName,
    startDate: cleanStartDate,
    endDate: cleanEndDate,
  };
}


// ============================================================
// GET
// 참여기간 목록
// ============================================================

export async function GET() {
  const access =
    await requireAdmin();

  if (!access.ok) {
    return access.response;
  }


  try {
    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("participation_periods")
        .select("*")
        .order(
          "start_at",
          {
            ascending: false,
          }
        )
        .limit(50);


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      periods: data || [],
    });

  } catch (error) {
    console.error(
      "[참여기간 조회 오류]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "참여기간을 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// POST
// 새 참여기간 생성
// ============================================================

export async function POST(
  request: NextRequest
) {
  const access =
    await requireAdmin();

  if (!access.ok) {
    return access.response;
  }


  try {
    const body =
      await request.json();


    const validation =
      validatePeriodInput(
        body.name,
        body.startDate,
        body.endDate
      );


    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: validation.message,
        },
        {
          status: 400,
        }
      );
    }


    // --------------------------------------------
    // 동시에 진행중인 기간은 1개만 허용
    // --------------------------------------------

    const {
      data: openPeriod,
      error: openError,
    } =
      await supabaseAdmin
        .from("participation_periods")
        .select("id, name")
        .eq(
          "status",
          "open"
        )
        .limit(1)
        .maybeSingle();


    if (openError) {
      throw openError;
    }


    if (openPeriod) {
      return NextResponse.json(
        {
          success: false,
          message:
            `이미 진행중인 참여기간이 있습니다. (${openPeriod.name})`,
        },
        {
          status: 409,
        }
      );
    }


    const startAt =
      kstStartOfDay(
        validation.startDate
      );

    const endAt =
      kstNextDay(
        validation.endDate
      );


    const discordId =
      access.session.user.discordId ||
      null;


    const {
      data: created,
      error,
    } =
      await supabaseAdmin
        .from("participation_periods")
        .insert({
          name:
            validation.name,

          start_at:
            startAt,

          end_at:
            endAt,

          status:
            "open",

          created_by:
            discordId,
        })
        .select("*")
        .single();


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      period: created,
    });

  } catch (error) {
    console.error(
      "[참여기간 생성 오류]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "참여기간을 생성하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// PATCH
//
// action = update
// → 진행중 기간 수정
//
// action = close
// → 기간 마감
// ============================================================

export async function PATCH(
  request: NextRequest
) {
  const access =
    await requireAdmin();

  if (!access.ok) {
    return access.response;
  }


  try {
    const body =
      await request.json();


    const action =
      String(
        body.action ||
        ""
      ).trim();


    const periodId =
      String(
        body.periodId ||
        ""
      ).trim();


    if (!periodId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "참여기간 ID가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }


    // --------------------------------------------
    // 기존 기간 확인
    // --------------------------------------------

    const {
      data: period,
      error: periodError,
    } =
      await supabaseAdmin
        .from("participation_periods")
        .select("*")
        .eq(
          "id",
          periodId
        )
        .maybeSingle();


    if (periodError) {
      throw periodError;
    }


    if (!period) {
      return NextResponse.json(
        {
          success: false,
          message:
            "참여기간을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // UPDATE
    // ========================================================

    if (action === "update") {
      if (
        period.status !==
        "open"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "마감된 참여기간은 수정할 수 없습니다.",
          },
          {
            status: 400,
          }
        );
      }


      const validation =
        validatePeriodInput(
          body.name,
          body.startDate,
          body.endDate
        );


      if (!validation.ok) {
        return NextResponse.json(
          {
            success: false,
            message:
              validation.message,
          },
          {
            status: 400,
          }
        );
      }


      const startAt =
        kstStartOfDay(
          validation.startDate
        );

      const endAt =
        kstNextDay(
          validation.endDate
        );


      const {
        data: updated,
        error: updateError,
      } =
        await supabaseAdmin
          .from(
            "participation_periods"
          )
          .update({
            name:
              validation.name,

            start_at:
              startAt,

            end_at:
              endAt,
          })
          .eq(
            "id",
            periodId
          )
          .eq(
            "status",
            "open"
          )
          .select("*")
          .single();


      if (updateError) {
        throw updateError;
      }


      return NextResponse.json({
        success: true,

        message:
          "참여기간을 수정했습니다.",

        period:
          updated,
      });
    }


    // ========================================================
    // CLOSE
    // ========================================================

    if (action === "close") {
      if (
        period.status !==
        "open"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "이미 마감된 참여기간입니다.",
          },
          {
            status: 400,
          }
        );
      }


      // --------------------------------------------
      // 현재 주간 집계 계산
      // --------------------------------------------

      const {
        data: summaryRows,
        error: summaryError,
      } =
        await supabaseAdmin.rpc(
          "get_period_participation_summary",
          {
            p_period_id:
              periodId,
          }
        );


      if (summaryError) {
        throw summaryError;
      }


      const rows =
        Array.isArray(
          summaryRows
        )
          ? summaryRows
          : [];


      // --------------------------------------------
      // 기존 스냅샷 제거
      //
      // open 상태에서 마감하는 시점의 값으로
      // 최종 스냅샷 생성
      // --------------------------------------------

      const {
        error: deleteSummaryError,
      } =
        await supabaseAdmin
          .from(
            "participation_period_summaries"
          )
          .delete()
          .eq(
            "period_id",
            periodId
          );


      if (deleteSummaryError) {
        throw deleteSummaryError;
      }


      if (rows.length > 0) {
        const snapshotRows =
          rows.map(
            (
              row: Record<
                string,
                unknown
              >
            ) => ({
              period_id:
                periodId,

              discord_id:
                String(
                  row.discord_id ??
                  row.discordId ??
                  ""
                ),

              nickname:
                String(
                  row.nickname ??
                  ""
                ),

              guild:
                String(
                  row.guild ??
                  ""
                ),

              participation_count:
                Number(
                  row.participation_count ??
                  row.participationCount ??
                  0
                ),

              target_count:
                Number(
                  row.target_count ??
                  row.targetCount ??
                  0
                ),

              base_score:
                Number(
                  row.base_score ??
                  row.baseScore ??
                  0
                ),

              adjustment_score:
                Number(
                  row.adjustment_score ??
                  row.adjustmentScore ??
                  0
                ),

              final_score:
                Number(
                  row.final_score ??
                  row.finalScore ??
                  0
                ),

              participation_rate:
                Number(
                  row.participation_rate ??
                  row.participationRate ??
                  0
                ),

              distribution_rate:
                0,

              total_distribution:
                0,

              distribution_amount:
                0,

              rank:
                Number(
                  row.rank ??
                  0
                ),
            })
          );


        const {
          error: insertSummaryError,
        } =
          await supabaseAdmin
            .from(
              "participation_period_summaries"
            )
            .insert(
              snapshotRows
            );


        if (insertSummaryError) {
          throw insertSummaryError;
        }
      }


      const discordId =
        access.session.user.discordId ||
        null;


      const {
        data: closed,
        error: closeError,
      } =
        await supabaseAdmin
          .from(
            "participation_periods"
          )
          .update({
            status:
              "closed",

            closed_by:
              discordId,

            closed_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            periodId
          )
          .eq(
            "status",
            "open"
          )
          .select("*")
          .single();


      if (closeError) {
        throw closeError;
      }


      return NextResponse.json({
        success: true,

        message:
          "참여기간을 마감했습니다.",

        period:
          closed,
      });
    }


    return NextResponse.json(
      {
        success: false,
        message:
          "지원하지 않는 작업입니다.",
      },
      {
        status: 400,
      }
    );

  } catch (error) {
    console.error(
      "[참여기간 수정/마감 오류]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "참여기간 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}