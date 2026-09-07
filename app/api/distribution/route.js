import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const nickname =
      searchParams.get("nickname")?.trim() || "";

    if (!nickname) {
      return NextResponse.json({
        success: false,
        message: "닉네임을 입력해주세요.",
      });
    }

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

    const url =
      `${googleScriptUrl}` +
      `?action=search` +
      `&nickname=${encodeURIComponent(nickname)}`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Google API 오류: ${response.status}`
      );
    }

    const data =
      await response.json();

    return NextResponse.json(data);
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