import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


function clean(
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

    const expectedSecret =
      process.env
        .MINGBOT_API_SECRET
        ?.trim();


    const receivedSecret =
      request.headers
        .get(
          "x-mingbot-secret"
        )
        ?.trim();


    if (
      !expectedSecret ||
      !receivedSecret ||
      receivedSecret !==
        expectedSecret
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "밍봇 API 인증에 실패했습니다.",
        },
        {
          status: 401,
        }
      );
    }


    const body =
      await request.json();


    const instanceKey =
      clean(
        body.instanceKey
      ) ||
      "main";


    const heartbeatAt =
      new Date();


    const {
      error,
    } =
      await supabaseAdmin
        .from(
          "mingbot_heartbeats"
        )
        .upsert(
          {
            instance_key:
              instanceKey,

            bot_user_id:
              clean(
                body.botUserId
              ) ||
              null,

            bot_name:
              clean(
                body.botName
              ) ||
              null,

            version:
              clean(
                body.version
              ) ||
              null,

            guild_count:
              Math.max(
                0,
                Number(
                  body.guildCount ||
                  0
                )
              ),

            heartbeat_at:
              heartbeatAt
                .toISOString(),

            started_at:
              clean(
                body.startedAt
              ) ||
              null,
          },
          {
            onConflict:
              "instance_key",
          }
        );


    if (
      error
    ) {
      throw error;
    }


    return NextResponse.json({
      success: true,

      heartbeatAt:
        heartbeatAt
          .toISOString(),
    });


  } catch (
    error
  ) {

    console.error(
      "[MINGBOT HEARTBEAT]",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "밍봇 heartbeat 저장 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
