import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import ParticipationManager
  from "./ParticipationManager";


export default async function AdminParticipationPage() {

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


  if (
    !session.user.isAdmin &&
    !session.user.isMaster
  ) {

    redirect(
      "/admin"
    );
  }


  return (

    <ParticipationManager
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