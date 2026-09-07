import {
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


type HeartbeatRow = {
  instance_key: string;
  bot_user_id: string | null;
  bot_name: string | null;
  version: string | null;
  guild_count: number;
  heartbeat_at: string;
  started_at: string | null;
  updated_at: string;
};


export async function GET() {

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


    if (
      !session.user.isAdmin &&
      !session.user.isMaster
    ) {

      return NextResponse.json(
        {
          success: false,
          message:
            "관리자 권한이 필요합니다.",
        },
        {
          status: 403,
        }
      );
    }


    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "mingbot_heartbeats"
        )
        .select(
          [
            "instance_key",
            "bot_user_id",
            "bot_name",
            "version",
            "guild_count",
            "heartbeat_at",
            "started_at",
            "updated_at",
          ].join(",")
        )
        .eq(
          "instance_key",
          "main"
        )
        .maybeSingle();


    if (
      error
    ) {
      throw error;
    }


    const heartbeat =
      data as unknown as
      HeartbeatRow | null;


    if (
      !heartbeat
    ) {

      return NextResponse.json({
        success: true,

        status:
          "unknown",

        online:
          false,

        ageSeconds:
          null,

        heartbeat:
          null,
      });
    }


    const heartbeatMs =
      new Date(
        heartbeat.heartbeat_at
      ).getTime();


    const ageSeconds =
      Number.isFinite(
        heartbeatMs
      )
        ? Math.max(
            0,
            Math.floor(
              (
                Date.now() -
                heartbeatMs
              ) /
              1000
            )
          )
        : null;


    let status:
      | "online"
      | "delayed"
      | "offline" =
        "offline";


    if (
      ageSeconds !==
      null
    ) {

      if (
        ageSeconds <=
        75
      ) {
        status =
          "online";

      } else if (
        ageSeconds <=
        180
      ) {
        status =
          "delayed";
      }
    }


    return NextResponse.json({
      success: true,

      status,

      online:
        status ===
        "online",

      ageSeconds,

      heartbeat: {
        instanceKey:
          heartbeat.instance_key,

        botUserId:
          heartbeat.bot_user_id,

        botName:
          heartbeat.bot_name,

        version:
          heartbeat.version,

        guildCount:
          heartbeat.guild_count,

        heartbeatAt:
          heartbeat.heartbeat_at,

        startedAt:
          heartbeat.started_at,

        updatedAt:
          heartbeat.updated_at,
      },
    });


  } catch (
    error
  ) {

    console.error(
      "[ADMIN MINGBOT STATUS]",
      error
    );


    return NextResponse.json(
      {
        success: false,
        message:
          "밍봇 연결상태를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}
