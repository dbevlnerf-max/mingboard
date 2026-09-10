import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  setMemberLifecycleStatus,
} from "@/lib/member-lifecycle";


function stringValue(
  value: unknown
) {
  return String(
    value ??
    ""
  ).trim();
}


export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const receivedSecret =
      stringValue(
        body.secret
      );

    const expectedSecret =
      stringValue(
        process.env
          .GUILD_WRITE_SECRET
      );


    if (
      !expectedSecret ||
      receivedSecret !==
      expectedSecret
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "서버 인증에 실패했습니다.",
        },
        {
          status: 401,
        }
      );
    }


    const gid =
      Number(
        body.gid
      );

    const rawStatus =
      stringValue(
        body.status
      )
        .toLowerCase();


    const status =
      rawStatus ===
        "left" ||
      rawStatus ===
        "탈퇴"
        ? "left"
        : rawStatus ===
            "banned" ||
          rawStatus ===
            "차단"
        ? "banned"
        : rawStatus ===
            "active" ||
          rawStatus ===
            "활동"
        ? "active"
        : null;


    if (
      !Number.isSafeInteger(
        gid
      ) ||
      gid <=
        0 ||
      !status
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "올바른 GID와 상태가 필요합니다.",
        },
        {
          status: 400,
        }
      );
    }


    const result =
      await setMemberLifecycleStatus({
        gid,
        status,
        actorDiscordId:
          "google-sheet",
        reason:
          "google_sheet_status_change",
      });


    return NextResponse.json({
      success: true,
      gid:
        String(
          gid
        ),
      status,
      linksRevoked:
        result.linksRevoked,
      roleResults:
        result.roleResults,
    });

  } catch (
    error
  ) {
    console.error(
      "[member status sync]",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "상태 동기화에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
