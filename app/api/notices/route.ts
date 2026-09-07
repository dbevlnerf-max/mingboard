import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


/* =========================================================
   GET
   공지 목록 조회
========================================================= */

export async function GET() {

  try {

    const session =
      await auth();


    if (
      !session?.user ||
      !session.user.isGuildMember ||
      !session.user.hasZeusRole
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "인증된 길드원만 이용할 수 있습니다.",
        },
        {
          status: 401,
        }
      );
    }


    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("notices")
        .select("*")
        .order(
          "is_pinned",
          {
            ascending: false,
          }
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      notices:
        data || [],
    });

  } catch (error) {

    console.error(
      "GET /api/notices",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "공지사항을 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}



/* =========================================================
   POST
   공지 등록
========================================================= */

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


    const canManage =
      Boolean(
        session.user.isAdmin ||
        session.user.isMaster
      );


    if (!canManage) {

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
        body.isPinned
      );


    if (!title) {

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


    if (!content) {

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


    if (
      title.length > 100
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "제목은 100자 이하로 입력해주세요.",
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
        .from("notices")
        .insert({
          title,
          content,

          is_pinned:
            isPinned,

          created_by:
            session.user.name ||
            "관리자",

          created_by_discord_id:
            session.user.discordId ||
            null,
        })
        .select()
        .single();


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      notice: data,
    });

  } catch (error) {

    console.error(
      "POST /api/notices",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "공지사항을 등록하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}