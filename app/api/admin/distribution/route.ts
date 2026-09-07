import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  writeAuditLog,
} from "@/lib/audit";


async function checkAdmin() {

  const session =
    await auth();


  if (
    !session?.user
  ) {

    return {
      ok: false,
      status: 401,
      message:
        "로그인이 필요합니다.",
      session: null,
    };
  }


  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {

    return {
      ok: false,
      status: 403,
      message:
        "길드 인증이 필요합니다.",
      session,
    };
  }


  if (
    !session.user.isAdmin &&
    !session.user.isMaster
  ) {

    return {
      ok: false,
      status: 403,
      message:
        "관리자 권한이 필요합니다.",
      session,
    };
  }


  return {
    ok: true,
    status: 200,
    message: "",
    session,
  };
}


// =====================================================
// GET
// =====================================================

export async function GET() {

  try {

    const authResult =
      await checkAdmin();


    if (
      !authResult.ok
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            authResult.message,
        },
        {
          status:
            authResult.status,
        }
      );
    }


    const googleScriptUrl =
      process.env
        .GOOGLE_SCRIPT_URL;


    if (
      !googleScriptUrl
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "GOOGLE_SCRIPT_URL 설정이 없습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const response =
      await fetch(
        `${googleScriptUrl}?action=distribution`,
        {
          cache:
            "no-store",
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            data.message ||
            "분배기준을 불러오지 못했습니다.",
        },
        {
          status: 400,
        }
      );
    }


    return NextResponse.json(
      data
    );


  } catch (
    error
  ) {

    console.error(
      "GET DISTRIBUTION ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "분배기준을 불러오는 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// =====================================================
// PATCH
// =====================================================

export async function PATCH(
  request: Request
) {

  try {

    const authResult =
      await checkAdmin();


    if (
      !authResult.ok ||
      !authResult.session
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            authResult.message,
        },
        {
          status:
            authResult.status,
        }
      );
    }


    const body =
      await request.json();


    const startRow =
      Number(
        body.startRow
      );


    const item =
      String(
        body.item ||
        ""
      ).trim();


    const rule =
      String(
        body.rule ||
        ""
      ).trim();


    const minimumDiamonds =
      Array.isArray(
        body.minimumDiamonds
      )
        ? body.minimumDiamonds.map(
            (
              value: unknown
            ) =>
              String(
                value ||
                ""
              ).trim()
          )
        : [];


    const beforeData =
      body.beforeData &&
      typeof body.beforeData ===
        "object"
        ? body.beforeData
        : null;


    if (
      !Number.isInteger(
        startRow
      )
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "분배기준 위치가 올바르지 않습니다.",
        },
        {
          status: 400,
        }
      );
    }


    const googleScriptUrl =
      process.env
        .GOOGLE_SCRIPT_URL;


    const secret =
      process.env
        .GUILD_WRITE_SECRET;


    if (
      !googleScriptUrl ||
      !secret
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "Google Sheet 연동 설정이 없습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const response =
      await fetch(
        googleScriptUrl,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              action:
                "updateDistributionRule",

              secret,

              startRow,

              item,

              rule,

              minimumDiamonds,
            }),

          cache:
            "no-store",
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            data.message ||
            "분배기준 수정에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "UPDATE",

        targetType:
          "distribution_rule",

        targetId:
          String(
            startRow
          ),

        targetName:
          item,

        actorDiscordId:
          String(
            authResult
              .session
              .user
              .discordId ||
            ""
          ),

        actorName:
          authResult
            .session
            .user
            .name ||
          "관리자",

        actorRole:
          authResult
            .session
            .user
            .isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData:
          beforeData,

        afterData: {
          item,
          rule,
          minimumDiamonds,
        },

        description:
          `분배기준 수정 · ${item}`,
      });


    return NextResponse.json({

      success:
        true,

      message:
        "분배기준을 수정했습니다.",

      rule:
        data.rule,

      auditSaved:
        auditResult.success,
    });


  } catch (
    error
  ) {

    console.error(
      "PATCH DISTRIBUTION ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "분배기준 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}