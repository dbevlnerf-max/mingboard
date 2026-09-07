import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import MembersManager from "./MembersManager";


export default async function MembersAdminPage() {

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
    redirect("/admin");
  }


  return (

    <MembersManager
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