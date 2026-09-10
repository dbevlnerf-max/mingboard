import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  writeAuditLog,
} from "@/lib/audit";

import {
  setMemberLifecycleStatus,
} from "@/lib/member-lifecycle";


type RouteContext = {
  params:
    Promise<{
      gid: string;
    }>;
};


type GuildMember = {
  gid: string;
  nickname: string;
  job: string;
  growthPower: string;
  growthPowerNumber: number;
  guild: string;
  attendanceRate: string;
  participationCount: number;
  targetCount: number;
};


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


async function getCurrentMember(
  googleScriptUrl: string,
  gid: string
) {

  try {

    const response =
      await fetch(
        `${googleScriptUrl}?action=guild`,
        {
          cache:
            "no-store",
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(
        data.members
      )
    ) {

      return null;
    }


    return (
      data.members.find(
        (
          member: GuildMember
        ) =>
          String(
            member.gid
          ) ===
          String(
            gid
          )
      ) ||
      null
    );


  } catch (
    error
  ) {

    console.error(
      "CURRENT MEMBER ERROR:",
      error
    );


    return null;
  }
}


// =====================================================
// PATCH
// =====================================================

export async function PATCH(
  request: Request,
  context: RouteContext
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


    const {
      gid,
    } =
      await context.params;


    const cleanGid =
      String(
        gid
      ).trim();


    const body =
      await request.json();


    const nickname =
      String(
        body.nickname || ""
      ).trim();


    const job =
      String(
        body.job || ""
      ).trim();


    const growthPower =
      String(
        body.growthPower || ""
      )
        .replace(
          /,/g,
          ""
        )
        .trim();


    const guild =
      String(
        body.guild || ""
      ).trim();


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
            "서버 연동 설정이 없습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const beforeMember =
      await getCurrentMember(
        googleScriptUrl,
        cleanGid
      );


    if (
      !beforeMember
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "수정 전 길드원 정보를 찾지 못했습니다.",
        },
        {
          status: 404,
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
                "updateGuildMember",

              secret,

              gid:
                cleanGid,

              nickname,

              job,

              growthPower,

              guild,
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
            "길드원 수정 실패",
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
          "guild_member",

        targetId:
          String(
            data.member?.gid ||
            cleanGid
          ),

        targetName:
          nickname,

        actorDiscordId:
          String(
            authResult.session
              .user.discordId ||
            ""
          ),

        actorName:
          authResult.session
            .user.name ||
          "관리자",

        actorRole:
          authResult.session
            .user.isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData:
          beforeMember,

        afterData: {
          gid:
            data.member?.gid ||
            cleanGid,

          nickname,

          job,

          growthPower:
            Number(
              growthPower
            ),

          guild,
        },

        description:
          `${nickname} 길드원 정보 수정`,
      });


    return NextResponse.json({

      success: true,

      message:
        "길드원 정보를 수정했습니다.",

      auditSaved:
        auditResult.success,

      auditWarning:
        auditResult.success
          ? null
          : auditResult.message,
    });


  } catch (
    error
  ) {

    console.error(
      "UPDATE MEMBER ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "길드원 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// =====================================================
// DELETE
//
// 기존 관리자 UI의 DELETE 호출은 유지하되
// 물리삭제가 아니라 "탈퇴처리"로 동작한다.
// =====================================================

export async function DELETE(
  request: Request,
  context: RouteContext
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


    const {
      gid,
    } =
      await context.params;


    const cleanGid =
      String(
        gid
      ).trim();


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
            "서버 연동 설정이 없습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const beforeMember =
      await getCurrentMember(
        googleScriptUrl,
        cleanGid
      );


    if (
      !beforeMember
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "탈퇴 처리할 길드원 정보를 찾지 못했습니다.",
        },
        {
          status: 404,
        }
      );
    }


    /*
      1) Supabase 접근상태와 Discord 연결을 먼저 회수한다.
      Discord 역할 제거가 실패해도 revoked_at 때문에
      밍보드 접근은 차단된다.
    */

    const lifecycle =
      await setMemberLifecycleStatus({
        gid:
          cleanGid,
        status:
          "left",
        actorDiscordId:
          String(
            authResult.session
              .user.discordId ||
            ""
          ),
        reason:
          "admin_member_leave",
      });


    /*
      2) Google Sheet는 v2 매크로의 기존 deleteGuildMember 호출을 사용한다.
      v2에서는 이 호출이 행 삭제가 아니라 상태=탈퇴로 동작한다.
    */

    let sheetSynced =
      false;

    let sheetWarning:
      string | null =
      null;


    try {
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
                  "deleteGuildMember",

                secret,

                gid:
                  cleanGid,
              }),

            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      sheetSynced =
        response.ok &&
        Boolean(
          data.success
        );


      if (
        !sheetSynced
      ) {
        sheetWarning =
          data.message ||
          "Google Sheet 탈퇴 상태 반영에 실패했습니다.";
      }

    } catch (
      error
    ) {
      sheetWarning =
        error instanceof Error
          ? error.message
          : "Google Sheet 탈퇴 상태 반영에 실패했습니다.";
    }


    const failedRoles =
      lifecycle.roleResults.filter(
        result =>
          !result.success
      );


    const auditResult =
      await writeAuditLog({

        action:
          "UPDATE",

        targetType:
          "guild_member_status",

        targetId:
          cleanGid,

        targetName:
          beforeMember.nickname,

        actorDiscordId:
          String(
            authResult.session
              .user.discordId ||
            ""
          ),

        actorName:
          authResult.session
            .user.name ||
          "관리자",

        actorRole:
          authResult.session
            .user.isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData:
          beforeMember,

        afterData: {
          status:
            "left",
          linksRevoked:
            lifecycle.linksRevoked,
          roleResults:
            lifecycle.roleResults,
          sheetSynced,
        },

        description:
          `${beforeMember.nickname} 길드원 탈퇴처리`,
      });


    const warnings = [
      sheetWarning,
      failedRoles.length >
      0
        ? `Discord 제우스 역할 회수 ${failedRoles.length}건 실패. 밍보드 접근은 이미 차단했습니다.`
        : null,
      auditResult.success
        ? null
        : auditResult.message,
    ].filter(
      Boolean
    );


    return NextResponse.json({

      success: true,

      message:
        `${beforeMember.nickname}님을 탈퇴 처리했습니다.`,

      status:
        "left",

      linksRevoked:
        lifecycle.linksRevoked,

      discordRoleRemoved:
        failedRoles.length ===
        0,

      roleResults:
        lifecycle.roleResults,

      sheetSynced,

      auditSaved:
        auditResult.success,

      warning:
        warnings.length >
        0
          ? warnings.join(
              " / "
            )
          : null,
    });


  } catch (
    error
  ) {

    console.error(
      "LEAVE MEMBER ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "길드원 탈퇴처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
