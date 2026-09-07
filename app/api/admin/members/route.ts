import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  writeAuditLog,
} from "@/lib/audit";


export async function POST(
  request: Request
) {

  try {

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


    if (
      !session.user.isGuildMember ||
      !session.user.hasZeusRole
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "길드 인증이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }


    if (
      !session.user.isAdmin &&
      !session.user.isMaster
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }


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


    if (
      !nickname ||
      !job ||
      !growthPower
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "닉네임, 직업, 성장력을 모두 입력해주세요.",
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
            "Google Sheet 서버 설정이 없습니다.",
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
                "addGuildMember",

              secret,

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
            "길드원 추가에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "CREATE",

        targetType:
          "guild_member",

        targetId:
          String(
            data.member?.gid ||
            ""
          ),

        targetName:
          nickname,

        actorDiscordId:
          String(
            session.user.discordId ||
            ""
          ),

        actorName:
          session.user.name ||
          "관리자",

        actorRole:
          session.user.isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData:
          null,

        afterData: {
          gid:
            data.member?.gid,

          nickname,

          job,

          growthPower:
            Number(
              growthPower
            ),

          guild,
        },

        description:
          `${nickname} 길드원 추가`,
      });


    return NextResponse.json({

      success: true,

      message:
        data.message ||
        "길드원을 추가했습니다.",

      member:
        data.member,

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
      "ADD MEMBER ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "길드원을 추가하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}