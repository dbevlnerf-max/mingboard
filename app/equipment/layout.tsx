import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.authVerificationPending ||
      !(session.user.isAdmin || session.user.isMaster)) {
    redirect("/");
  }
  return <>{children}</>;
}
