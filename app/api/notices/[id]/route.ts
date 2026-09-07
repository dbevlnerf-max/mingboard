import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

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


    const title =
      String(
        body.title || ""
      ).trim();


    const content =
      String(
        body.content || ""
      ).trim();


    const isPinned =
      Boolean(
        body.is_pinned
      );


    if (
      !title
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "공지 제목을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    if (
      !content
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "공지 내용을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "notices"
        )
        .insert({
          title,

          content,

          is_pinned:
            isPinned,

          created_by:
            session.user.name ||
            "관리자",
        })
        .select("*")
        .single();


    if (
      error
    ) {

      console.error(
        "NOTICE CREATE ERROR:",
        error
      );


      return NextResponse.json(
        {
          success: false,
          message:
            error.message,
        },
        {
          status: 500,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "CREATE",

        targetType:
          "notice",

        targetId:
          String(
            data.id
          ),

        targetName:
          title,

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
          id:
            data.id,

          title:
            data.title,

          content:
            data.content,

          is_pinned:
            data.is_pinned,
        },

        description:
          `공지사항 추가 · ${title}`,
      });


    return NextResponse.json({

      success: true,

      message:
        "공지사항을 등록했습니다.",

      notice:
        data,

      auditSaved:
        auditResult.success,
    });


  } catch (
    error
  ) {

    console.error(
      "POST NOTICE ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "공지사항 등록 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}