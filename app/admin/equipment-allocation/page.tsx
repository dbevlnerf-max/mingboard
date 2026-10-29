import { redirect } from "next/navigation";
import { auth } from "@/auth";
import EquipmentAllocationAdmin from "./EquipmentAllocationAdmin";
import { getMemberAccess } from "@/lib/guild-scoped-admin";

export default async function EquipmentAllocationAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const access = await getMemberAccess(session.user);
  if (access.kind === "denied") redirect("/admin");

  return <EquipmentAllocationAdmin />;
}
