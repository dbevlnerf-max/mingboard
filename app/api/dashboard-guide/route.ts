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
   길드 안내사항 조회
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
        .from(
          "dashboard_guides"
        )
        .select("*")
        .order(
          "id",
          {
            ascending: true,
          }
        )
        .limit(1)
        .maybeSingle();


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      guide: data || null,
    });

  } catch (error) {

    console.error(
      "GET /api/dashboard-guide",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "안내사항을 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}



/* =========================================================
   PATCH
   길드 안내사항 수정
========================================================= */

export async function PATCH(
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


    if (
      !canManage
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
        body.title ||
        "안내사항"
      ).trim();


    const content =
      String(
        body.content || ""
      ).trim();


    if (
      !title
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "안내 제목을 입력해주세요.",
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
            "안내 내용을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data:
        currentGuide,

      error:
        selectError,
    } =
      await supabaseAdmin
        .from(
          "dashboard_guides"
        )
        .select("id")
        .order(
          "id",
          {
            ascending: true,
          }
        )
        .limit(1)
        .maybeSingle();


    if (
      selectError
    ) {
      throw selectError;
    }


    const payload = {
      title,
      content,

      updated_by:
        session.user.name ||
        "관리자",

      updated_by_discord_id:
        session.user.discordId ||
        null,

      updated_at:
        new Date()
          .toISOString(),
    };


    /* 기존 안내가 있으면 수정 */

    if (
      currentGuide
    ) {

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "dashboard_guides"
          )
          .update(
            payload
          )
          .eq(
            "id",
            currentGuide.id
          )
          .select()
          .single();


      if (error) {
        throw error;
      }


      return NextResponse.json({
        success: true,
        guide: data,
      });
    }


    /* 안내가 없다면 새로 생성 */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "dashboard_guides"
        )
        .insert(
          payload
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    return NextResponse.json({
      success: true,
      guide: data,
    });

  } catch (error) {

    console.error(
      "PATCH /api/dashboard-guide",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "안내사항을 저장하지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}