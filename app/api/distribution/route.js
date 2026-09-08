import { NextResponse } from "next/server";

export async function GET() {
  try {
    const googleScriptUrl =
      process.env.GOOGLE_SCRIPT_URL;

    if (!googleScriptUrl) {
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

    const separator =
      googleScriptUrl.includes("?")
        ? "&"
        : "?";

    const url =
      `${googleScriptUrl}${separator}` +
      "action=distributionList";

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Google API 오류: ${response.status}`
      );
    }

    const text =
      await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
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

  } catch (error) {
    console.error(
      "Distribution API Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "분배 데이터를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
