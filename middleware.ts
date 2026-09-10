import { NextResponse } from "next/server";

import { auth } from "@/auth";

export default auth(
  request => {
    const session = request.auth;
    const pathname = request.nextUrl.pathname;

    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname === "/favicon.ico"
    ) {
      return NextResponse.next();
    }

    if (pathname === "/link-account") {
      if (session?.user?.hasActiveCharacterLink) {
        return NextResponse.redirect(
          new URL("/", request.nextUrl)
        );
      }

      return NextResponse.next();
    }

    if (session?.user?.needsCharacterLink) {
      return NextResponse.redirect(
        new URL("/link-account", request.nextUrl)
      );
    }

    return NextResponse.next();
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
