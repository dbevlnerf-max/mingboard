import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import MembersManager from "./MembersManager";
import ScopedMembersManager from "./ScopedMembersManager";
import { getMemberAccess } from "@/lib/guild-scoped-admin";


export default async function MembersAdminPage() {

  const session =
    await auth();


  if (
    !session?.user
  ) {
    redirect("/");
  }


  // Scoped operators have their own verified Discord role and do not
  // inherit the full-admin or additional Zeus-role prerequisites.
  const access = await getMemberAccess(session.user);
  if (access.kind === "denied") redirect("/admin");
  if (access.kind === "scoped") return <ScopedMembersManager guild={access.guild} />;

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