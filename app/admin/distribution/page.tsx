import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import DistributionManager
  from "./DistributionManager";


export default async function DistributionAdminPage() {

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
    <DistributionManager
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