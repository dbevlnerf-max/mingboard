import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


// ============================================================
// 관리자
// ============================================================

async function requireAdmin() {
  const session =
    await auth();


  if (
    !session?.user
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,
            message:
              "로그인이 필요합니다.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  if (
    !session.user.isAdmin &&
    !session.user.isMaster
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,
            message:
              "관리자 권한이 필요합니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }


  return {
    ok:
      true as const,

    session,
  };
}


// ============================================================
// 숫자
// ============================================================

function numberValue(
  value: unknown
) {
  const number =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


// ============================================================
// 닉네임
// ============================================================

function normalizeNickname(
  value: unknown
) {
  return String(
    value ??
    ""
  )
    .replace(
      /\s+/g,
      ""
    )
    .trim()
    .toLowerCase();
}


// ============================================================
// Apps Script
// ============================================================

async function callGoogleScript(
  body:
    Record<
      string,
      unknown
    >
) {
  const url =
    process.env
      .GOOGLE_SCRIPT_URL;


  const secret =
    process.env
      .GUILD_WRITE_SECRET;


  if (!url) {
    throw new Error(
      "GOOGLE_SCRIPT_URL이 설정되지 않았습니다."
    );
  }


  if (!secret) {
    throw new Error(
      "GUILD_WRITE_SECRET이 설정되지 않았습니다."
    );
  }


  const response =
    await fetch(
      url,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8",
        },

        body:
          JSON.stringify({
            ...body,
            secret,
          }),

        cache:
          "no-store",

        redirect:
          "follow",
      }
    );


  const text =
    await response.text();


  let data:
    any;


  try {
    data =
      JSON.parse(
        text
      );

  } catch {
    throw new Error(
      `Google Apps Script 응답 형식 오류: ${text.slice(
        0,
        200
      )}`
    );
  }


  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
      "Google Sheet 요청에 실패했습니다."
    );
  }


  return data;
}


// ============================================================
// 길드현황
// ============================================================

async function getGuildMembers() {
  const baseUrl =
    process.env
      .GOOGLE_SCRIPT_URL;


  if (!baseUrl) {
    throw new Error(
      "GOOGLE_SCRIPT_URL이 설정되지 않았습니다."
    );
  }


  const separator =
    baseUrl.includes("?")
      ? "&"
      : "?";


  const response =
    await fetch(
      `${baseUrl}${separator}action=guild`,
      {
        cache:
          "no-store",

        redirect:
          "follow",
      }
    );


  const data =
    await response.json();


  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
      "길드현황 조회 실패"
    );
  }


  const rows =
    data.members ??
    data.rows ??
    [];


  return Array.isArray(
    rows
  )
    ? rows
    : [];
}


// ============================================================
// GET 상태
// ============================================================

export async function GET() {
  const access =
    await requireAdmin();


  if (!access.ok) {
    return access.response;
  }


  try {
    const status =
      await callGoogleScript({
        action:
          "participationSyncStatus",
      });


    return NextResponse.json({
      success: true,

      enabled:
        status.enabled !==
        false,

      allowed:
        Boolean(
          status.allowed
        ),

      paused:
        Boolean(
          status.paused
        ),

      remainingSeconds:
        numberValue(
          status.remainingSeconds
        ),

      lastSyncAt:
        status.lastSyncAt ??
        null,
    });


  } catch (
    error
  ) {
    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "동기화 상태 조회 실패",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// POST
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
      await request
        .json()
        .catch(
          () => ({})
        );


    // ========================================================
    // 동기화 중지
    // ========================================================

    if (
      body.action ===
      "pause"
    ) {
      const result =
        await callGoogleScript({
          action:
            "participationSyncPause",
        });


      return NextResponse.json({
        success: true,

        enabled: false,

        message:
          result.message ||
          "동기화를 중지했습니다.",
      });
    }


    // ========================================================
    // 동기화 재활성화
    // ========================================================

    if (
      body.action ===
      "resume"
    ) {
      const result =
        await callGoogleScript({
          action:
            "participationSyncResume",
        });


      return NextResponse.json({
        success: true,

        enabled: true,

        message:
          result.message ||
          "동기화를 활성화했습니다.",
      });
    }


    // ========================================================
    // 현재 상태 확인
    // ========================================================

    const status =
      await callGoogleScript({
        action:
          "participationSyncStatus",
      });


    if (
      status.enabled ===
      false
    ) {
      return NextResponse.json(
        {
          success: false,

          paused: true,

          message:
            "참여율 시트 동기화가 중지되어 있습니다.",
        },
        {
          status: 409,
        }
      );
    }


    const force =
      body.force ===
      true;


    // ========================================================
    // 진행중 기간
    // ========================================================

    const {
      data: period,
      error: periodError,
    } =
      await supabaseAdmin
        .from(
          "participation_periods"
        )
        .select(
          "*"
        )
        .eq(
          "status",
          "open"
        )
        .order(
          "start_at",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();


    if (periodError) {
      throw periodError;
    }


    if (!period) {
      return NextResponse.json(
        {
          success: false,

          message:
            "진행중인 참여기간이 없습니다.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // Supabase 집계
    // ========================================================

    const {
      data:
        summaryData,

      error:
        summaryError,
    } =
      await supabaseAdmin.rpc(
        "get_period_participation_summary",
        {
          p_period_id:
            period.id,
        }
      );


    if (summaryError) {
      throw summaryError;
    }


    const summaryRows =
      Array.isArray(
        summaryData
      )
        ? summaryData
        : [];


    // ========================================================
    // 길드현황
    // ========================================================

    let guildMembers:
      any[] =
        [];


    try {
      guildMembers =
        await getGuildMembers();

    } catch (
      error
    ) {
      console.error(
        "[길드현황 조회 실패]",
        error
      );
    }


    const memberMap =
      new Map<
        string,
        {
          gid: string;
          nickname: string;
          guild: string;
        }
      >();


    for (
      const member
      of guildMembers
    ) {
      const nickname =
        String(
          member.nickname ??
          ""
        ).trim();


      if (!nickname) {
        continue;
      }


      memberMap.set(
        normalizeNickname(
          nickname
        ),
        {
          gid:
            String(
              member.gid ??
              ""
            ),

          nickname,

          guild:
            String(
              member.guild ??
              ""
            ),
        }
      );
    }


    // ========================================================
    // 시트 데이터
    // ========================================================

    const sheetRows =
      summaryRows.map(
        (
          row:
            any
        ) => {
          const nickname =
            String(
              row.nickname ??
              ""
            ).trim();


          const member =
            memberMap.get(
              normalizeNickname(
                nickname
              )
            );


          return {
            gid:
              member?.gid ||
              "",

            nickname:
              member?.nickname ||
              nickname,

            guild:
              member?.guild ||
              String(
                row.guild ??
                ""
              ),

            participationCount:
              numberValue(
                row.participation_count ??
                row.participationCount
              ),

            finalScore:
              numberValue(
                row.final_score ??
                row.finalScore
              ),

            participationRate:
              numberValue(
                row.participation_rate ??
                row.participationRate
              ),

            distributionAmount:
              0,
          };
        }
      );


    const targetCount =
      numberValue(
        summaryRows[0]
          ?.target_count ??
        summaryRows[0]
          ?.targetCount ??
        0
      );


    const googleResult =
      await callGoogleScript({
        action:
          "participationSync",

        rows:
          sheetRows,

        periodLabel:
          period.name,

        targetCount,

        force,
      });


    if (
      googleResult.synced ===
      false &&
      googleResult.reason ===
      "paused"
    ) {
      return NextResponse.json(
        {
          success: false,

          paused: true,

          message:
            "동기화가 중지되어 있습니다.",
        },
        {
          status: 409,
        }
      );
    }


    return NextResponse.json({
      success: true,

      period: {
        id:
          period.id,

        name:
          period.name,
      },

      targetCount,

      rowCount:
        sheetRows.length,

      rows:
        sheetRows,

      google:
        googleResult,
    });


  } catch (
    error
  ) {
    console.error(
      "[참여율 시트 API 오류]",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "참여율 시트 처리에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}