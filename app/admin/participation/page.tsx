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

  // Full menu remains visible, but this route is restricted server-side.
  if (session?.user?.scopedGuild && !session.user.isMaster) redirect("/admin/denied");


  if (
    !session?.user
  ) {

    redirect("/");
  }


  if (
    !session.user.isGuildMember ||
    (!session.user.hasZeusRole && !session.user.isAdmin && !session.user.isMaster)
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

    <ParticipationManager />

  );
}