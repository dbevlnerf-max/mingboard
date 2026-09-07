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


    if (
      !title
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "안내사항 제목을 입력해주세요.",
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
            "안내사항 내용을 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    /*
      현재 밍보드 안내사항은 1개 고정 레코드 방식으로 사용.
      id = 1 기준.
    */

    const {
      data: beforeGuide,
      error: beforeError,
    } =
      await supabaseAdmin
        .from(
          "dashboard_guide"
        )
        .select("*")
        .eq(
          "id",
          1
        )
        .maybeSingle();


    if (
      beforeError
    ) {

      console.error(
        "GUIDE BEFORE ERROR:",
        beforeError
      );


      return NextResponse.json(
        {
          success: false,
          message:
            beforeError.message,
        },
        {
          status: 500,
        }
      );
    }


    let savedGuide;


    if (
      beforeGuide
    ) {

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "dashboard_guide"
          )
          .update({
            title,

            content,

            updated_by:
              session.user.name ||
              "관리자",

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            1
          )
          .select("*")
          .single();


      if (
        error
      ) {

        console.error(
          "GUIDE UPDATE ERROR:",
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


      savedGuide =
        data;

    } else {

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "dashboard_guide"
          )
          .insert({
            id:
              1,

            title,

            content,

            updated_by:
              session.user.name ||
              "관리자",
          })
          .select("*")
          .single();


      if (
        error
      ) {

        console.error(
          "GUIDE CREATE ERROR:",
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


      savedGuide =
        data;
    }


    const auditResult =
      await writeAuditLog({

        action:
          beforeGuide
            ? "UPDATE"
            : "CREATE",

        targetType:
          "guide",

        targetId:
          "1",

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
          beforeGuide
            ? {
                title:
                  beforeGuide.title,

                content:
                  beforeGuide.content,
              }
            : null,

        afterData: {
          title:
            savedGuide.title,

          content:
            savedGuide.content,
        },

        description:
          `안내사항 ${beforeGuide ? "수정" : "등록"} · ${title}`,
      });


    return NextResponse.json({

      success: true,

      message:
        beforeGuide
          ? "안내사항을 수정했습니다."
          : "안내사항을 등록했습니다.",

      guide:
        savedGuide,

      auditSaved:
        auditResult.success,
    });


  } catch (
    error
  ) {

    console.error(
      "GUIDE PATCH ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "안내사항 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}