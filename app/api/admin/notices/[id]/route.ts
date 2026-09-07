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


type RouteContext = {
  params:
    Promise<{
      id: string;
    }>;
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


/* =====================================================
   PATCH
===================================================== */

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
      id,
    } =
      await context.params;


    const noticeId =
      Number(
        id
      );


    if (
      !Number.isFinite(
        noticeId
      )
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "올바른 공지 ID가 아닙니다.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data: beforeNotice,
      error: beforeError,
    } =
      await supabaseAdmin
        .from(
          "notices"
        )
        .select("*")
        .eq(
          "id",
          noticeId
        )
        .single();


    if (
      beforeError ||
      !beforeNotice
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "수정할 공지사항을 찾을 수 없습니다.",
        },
        {
          status: 404,
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
      !title ||
      !content
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "제목과 내용을 모두 입력해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data: updatedNotice,
      error: updateError,
    } =
      await supabaseAdmin
        .from(
          "notices"
        )
        .update({
          title,

          content,

          is_pinned:
            isPinned,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          noticeId
        )
        .select("*")
        .single();


    if (
      updateError
    ) {

      console.error(
        "NOTICE UPDATE ERROR:",
        updateError
      );


      return NextResponse.json(
        {
          success: false,
          message:
            updateError.message,
        },
        {
          status: 500,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "UPDATE",

        targetType:
          "notice",

        targetId:
          String(
            noticeId
          ),

        targetName:
          title,

        actorDiscordId:
          String(
            authResult.session.user.discordId ||
            ""
          ),

        actorName:
          authResult.session.user.name ||
          "관리자",

        actorRole:
          authResult.session.user.isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData: {
          id:
            beforeNotice.id,

          title:
            beforeNotice.title,

          content:
            beforeNotice.content,

          is_pinned:
            beforeNotice.is_pinned,
        },

        afterData: {
          id:
            updatedNotice.id,

          title:
            updatedNotice.title,

          content:
            updatedNotice.content,

          is_pinned:
            updatedNotice.is_pinned,
        },

        description:
          `공지사항 수정 · ${title}`,
      });


    return NextResponse.json({

      success: true,

      message:
        "공지사항을 수정했습니다.",

      notice:
        updatedNotice,

      auditSaved:
        auditResult.success,
    });


  } catch (
    error
  ) {

    console.error(
      "PATCH NOTICE ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "공지사항 수정 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


/* =====================================================
   DELETE
===================================================== */

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
      id,
    } =
      await context.params;


    const noticeId =
      Number(
        id
      );


    if (
      !Number.isFinite(
        noticeId
      )
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "올바른 공지 ID가 아닙니다.",
        },
        {
          status: 400,
        }
      );
    }


    const {
      data: beforeNotice,
      error: beforeError,
    } =
      await supabaseAdmin
        .from(
          "notices"
        )
        .select("*")
        .eq(
          "id",
          noticeId
        )
        .single();


    if (
      beforeError ||
      !beforeNotice
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "삭제할 공지사항을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }


    const {
      error: deleteError,
    } =
      await supabaseAdmin
        .from(
          "notices"
        )
        .delete()
        .eq(
          "id",
          noticeId
        );


    if (
      deleteError
    ) {

      console.error(
        "NOTICE DELETE ERROR:",
        deleteError
      );


      return NextResponse.json(
        {
          success: false,
          message:
            deleteError.message,
        },
        {
          status: 500,
        }
      );
    }


    const auditResult =
      await writeAuditLog({

        action:
          "DELETE",

        targetType:
          "notice",

        targetId:
          String(
            noticeId
          ),

        targetName:
          beforeNotice.title,

        actorDiscordId:
          String(
            authResult.session.user.discordId ||
            ""
          ),

        actorName:
          authResult.session.user.name ||
          "관리자",

        actorRole:
          authResult.session.user.isMaster
            ? "MASTER"
            : "ADMIN",

        beforeData: {
          id:
            beforeNotice.id,

          title:
            beforeNotice.title,

          content:
            beforeNotice.content,

          is_pinned:
            beforeNotice.is_pinned,
        },

        afterData:
          null,

        description:
          `공지사항 삭제 · ${beforeNotice.title}`,
      });


    return NextResponse.json({

      success: true,

      message:
        "공지사항을 삭제했습니다.",

      auditSaved:
        auditResult.success,
    });


  } catch (
    error
  ) {

    console.error(
      "DELETE NOTICE ERROR:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "공지사항 삭제 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}