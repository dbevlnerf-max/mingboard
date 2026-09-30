import { handlers } from "@/auth";
import { warmPortalSheets } from "@/lib/sheet-read";
import type { NextRequest } from "next/server";

export const POST = handlers.POST;

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  if (response.ok && request.nextUrl.pathname.endsWith("/session")) {
    const session = await response.clone().json().catch(() => null);
    if (session?.user?.isGuildMember && session.user.hasZeusRole && !session.user.authVerificationPending) {
      warmPortalSheets();
    }
  }
  return response;
}
