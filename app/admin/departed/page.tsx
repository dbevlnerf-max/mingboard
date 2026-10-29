import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import DepartedMembersClient from "./DepartedMembersClient";
import { getMemberAccess } from "@/lib/guild-scoped-admin";


export default async function DepartedMembersPage() {
  const session =
    await auth();

  if (!session?.user) {
    redirect("/");
  }

  const access = await getMemberAccess(session.user);
  if (access.kind === "denied") redirect("/admin");

  return (
    <DepartedMembersClient
      currentUser={
        session.user.name || "관리자"
      }
      isMaster={Boolean(session.user.isMaster)}
      scopedGuild={access.kind === "scoped" ? access.guild : null}
    />
  );
}
