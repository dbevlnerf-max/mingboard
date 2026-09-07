import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";


export async function GET() {

  try {

    /* =====================================================
       Discord 인증
    ===================================================== */

    const session =
      await auth();


    if (
      !session?.user ||
      !session.user.isGuildMember ||
      !session.user.hasZeusRole
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "인증된 길드원만 이용할 수 있습니다.",
        },
        {
          status: 401,
        }
      );
    }


    /* =====================================================
       Google Apps Script URL
    ===================================================== */

    const googleScriptUrl =
      process.env.GOOGLE_SCRIPT_URL;


    if (
      !googleScriptUrl
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "Google Script 주소가 설정되지 않았습니다.",
        },
        {
          status: 500,
        }
      );
    }


    const url =
      `${googleScriptUrl}?action=guild`;


    /* =====================================================
       Google Sheet API 호출
    ===================================================== */

    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",
        }
      );


    if (
      !response.ok
    ) {

      throw new Error(
        `Google API 오류: ${response.status}`
      );
    }


    const data =
      await response.json();


    return NextResponse.json(
      data
    );


  } catch (error) {

    console.error(
      "Guild API Error:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "길드현황 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}