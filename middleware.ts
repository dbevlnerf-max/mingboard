import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";


export default auth(
  request => {

    const session =
      request.auth;

    const pathname =
      request.nextUrl.pathname;


    if (
      pathname.startsWith(
        "/api/auth"
      ) ||
      pathname.startsWith(
        "/api/account-link"
      ) ||
      pathname.startsWith(
        "/api/mingbot"
      ) ||
      pathname.startsWith(
        "/api/member-status-sync"
      ) ||
      pathname.startsWith(
        "/_next"
      ) ||
      pathname ===
        "/favicon.ico"
    ) {
      return NextResponse.next();
    }


    if (
      !session?.user
    ) {
      return NextResponse.next();
    }


    if (
      session.user.isMaster
    ) {
      return NextResponse.next();
    }


    const needsCharacterLink =
      Boolean(
        session.user
          .isGuildMember &&
        session.user
          .hasZeusRole &&
        !session.user
          .hasActiveCharacterLink
      );


    if (
      pathname ===
      "/link-account"
    ) {
      if (
        session.user
          .hasActiveCharacterLink
      ) {
        return NextResponse.redirect(
          new URL(
            "/",
            request.nextUrl
          )
        );
      }

      return NextResponse.next();
    }


    if (
      needsCharacterLink
    ) {
      if (
        pathname.startsWith(
          "/api/"
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            code:
              "CHARACTER_LINK_REQUIRED",
            message:
              "활성 길드 캐릭터 연결이 필요합니다.",
          },
          {
            status: 403,
          }
        );
      }


      return NextResponse.redirect(
        new URL(
          "/link-account",
          request.nextUrl
        )
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
