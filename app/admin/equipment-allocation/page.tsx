import { redirect } from "next/navigation";
import { auth } from "@/auth";
import EquipmentAllocationAdmin from "./EquipmentAllocationAdmin";

export default async function EquipmentAllocationAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.isGuildMember || !session.user.hasZeusRole) redirect("/");
  if (!session.user.isAdmin && !session.user.isMaster) redirect("/admin");

  return <EquipmentAllocationAdmin />;
}
