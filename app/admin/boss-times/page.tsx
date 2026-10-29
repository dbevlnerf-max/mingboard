import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import BossTimeManager
  from "./BossTimeManager";


export default async function BossTimesAdminPage() {

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
    !session.user.isAdmin &&
    !session.user.isMaster
  ) {
    redirect("/");
  }


  return (
    <BossTimeManager />
  );
}
