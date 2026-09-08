import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";


function cleanText(
  value: string | null
) {
  return String(
    value || ""
  ).trim();
}


function appendParam(
  params: URLSearchParams,
  key: string,
  value: string
) {
  if (value) {
    params.set(
      key,
      value
    );
  }
}


export async function GET(
  request: NextRequest
) {

  try {

    const session =
      await auth();


    if (
      !session?.user
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "로그인이 필요합니다.",
        },
        {
          status: 401,
        }
      );
    }


    const canAccess =
      Boolean(
        (
          session.user
            .isGuildMember &&
          session.user
            .hasZeusRole
        ) ||
        session.user
          .isAdmin ||
        session.user
          .isMaster
      );


    if (
      !canAccess
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "분배내역을 조회할 권한이 없습니다.",
        },
        {
          status: 403,
        }
      );
    }


    const googleScriptUrl =
      process.env
        .GOOGLE_SCRIPT_URL;


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


    const {
      searchParams,
    } =
      new URL(
        request.url
      );


    const nickname =
      cleanText(
        searchParams.get(
          "nickname"
        )
      );


    const action =
      nickname
        ? "search"
        : "distributionList";


    const upstreamParams =
      new URLSearchParams();

    upstreamParams.set(
      "action",
      action
    );


    if (
      nickname
    ) {

      upstreamParams.set(
        "nickname",
        nickname
      );

    } else {

      appendParam(
        upstreamParams,
        "startDate",
        cleanText(
          searchParams.get(
            "startDate"
          )
        )
      );

      appendParam(
        upstreamParams,
        "endDate",
        cleanText(
          searchParams.get(
            "endDate"
          )
        )
      );

      appendParam(
        upstreamParams,
        "category",
        cleanText(
          searchParams.get(
            "category"
          )
        )
      );

      appendParam(
        upstreamParams,
        "sort",
        cleanText(
          searchParams.get(
            "sort"
          )
        )
      );

      appendParam(
        upstreamParams,
        "page",
        cleanText(
          searchParams.get(
            "page"
          )
        )
      );

      appendParam(
        upstreamParams,
        "pageSize",
        cleanText(
          searchParams.get(
            "pageSize"
          )
        )
      );
    }


    const separator =
      googleScriptUrl
        .includes("?")
        ? "&"
        : "?";


    const url =
      `${googleScriptUrl}${separator}${upstreamParams.toString()}`;


    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",

          redirect:
            "follow",
        }
      );


    if (
      !response.ok
    ) {
      throw new Error(
        `Google API 오류: ${response.status}`
      );
    }


    const text =
      await response.text();


    let data:
      unknown;


    try {
      data =
        JSON.parse(
          text
        );

    } catch {
      throw new Error(
        "Google Script 응답을 읽지 못했습니다."
      );
    }


    return NextResponse.json(
      data,
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );


  } catch (
    error
  ) {

    console.error(
      "Distribution API Error:",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof
            Error
            ? error.message
            : "분배 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
