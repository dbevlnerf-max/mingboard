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
