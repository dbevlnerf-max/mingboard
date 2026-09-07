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
  supabaseAdmin,
} from "@/lib/supabase/admin";


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


async function getDiscordLinkCount(
  gid: string
) {

  const numericGid =
    Number(gid);


  if (
    !Number.isSafeInteger(
      numericGid
    ) ||
    numericGid <= 0
  ) {

    throw new Error(
      "올바른 GID가 아닙니다."
    );
  }


  const {
    count,
    error,
  } =
    await supabaseAdmin
      .from(
        "guild_member_discord_links"
      )
      .select(
        "id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq(
        "gid",
        numericGid
      );


  if (error) {
    throw error;
  }


  return count || 0;
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
            "삭제할 길드원 정보를 찾지 못했습니다.",
        },
        {
          status: 404,
        }
      );
    }


    const discordLinkCount =
      await getDiscordLinkCount(
        cleanGid
      );


    if (
      discordLinkCount > 0
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            `Discord 계정이 ${discordLinkCount}/2 연결되어 있어 길드원을 삭제할 수 없습니다. 먼저 Discord 연결을 해제해주세요.`,
          code:
            "DISCORD_LINK_EXISTS",
          discordLinkCount,
          discordLinkMax: 2,
        },
        {
          status: 409,
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


    if (
      !response.ok ||
      !data.success
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            data.message ||
            "길드원 삭제 실패",
        },
        {
          status: 400,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "DELETE",

        targetType:
          "guild_member",

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

        afterData:
          null,

        description:
          `${beforeMember.nickname} 길드원 삭제`,
      });


    return NextResponse.json({

      success: true,

      message:
        data.message ||
        "길드원을 삭제했습니다.",

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
      "DELETE MEMBER ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "길드원 삭제 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}