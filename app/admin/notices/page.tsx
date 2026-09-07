import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

import NoticeManager from "./NoticeManager";


export default async function NoticesAdminPage() {

  /* =====================================================
     Discord 세션
  ===================================================== */

  const session =
    await auth();


  if (
    !session?.user
  ) {
    redirect("/");
  }


  /* =====================================================
     길드 인증
  ===================================================== */

  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {
    redirect("/");
  }


  /* =====================================================
     관리자 권한
  ===================================================== */

  const canManage =
    Boolean(
      session.user.isAdmin ||
      session.user.isMaster
    );


  if (!canManage) {

    redirect(
      "/admin"
    );
  }


  /* =====================================================
     최초 공지 조회
  ===================================================== */

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

    console.error(
      "공지 조회 오류:",
      error
    );
  }


  return (

    <NoticeManager
      initialNotices={
        data || []
      }

      currentUser={
        session.user.name ||
        "관리자"
      }

      isMaster={
        Boolean(
          session.user.isMaster
        )
      }
    />

  );
}