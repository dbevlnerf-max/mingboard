import { redirect } from "next/navigation";

import { auth } from "@/auth";

import ParticipationClient from "./ParticipationClient";


export default async function ParticipationPage() {
  const session = await auth();


  if (!session?.user) {
    redirect("/");
  }


  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {
    redirect("/");
  }


  return (
    <ParticipationClient
      currentDiscordId={
        session.user.discordId || ""
      }
      currentUserName={
        session.user.name || ""
      }
    />
  );
}