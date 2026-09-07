import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

import GuideManager from "./GuideManager";


export default async function GuideAdminPage() {

  const session =
    await auth();


  if (
    !session?.user
  ) {
    redirect("/");
  }


  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {
    redirect("/");
  }


  const canManage =
    Boolean(
      session.user.isAdmin ||
      session.user.isMaster
    );


  if (
    !canManage
  ) {
    redirect(
      "/admin"
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


  if (
    error
  ) {

    console.error(
      "안내사항 조회 오류:",
      error
    );
  }


  return (

    <GuideManager

      initialGuide={
        data || null
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