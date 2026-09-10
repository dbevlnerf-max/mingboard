import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import DepartedMembersClient from "./DepartedMembersClient";


export default async function DepartedMembersPage() {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole ||
    (!session.user.isAdmin && !session.user.isMaster)
  ) {
    redirect("/");
  }

  return (
    <DepartedMembersClient
      currentUser={
        session.user.name || "관리자"
      }
      isMaster={
        Boolean(session.user.isMaster)
      }
    />
  );
}
