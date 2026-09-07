import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


// ============================================================
// TYPES
// ============================================================

type Participant = {

  discordId:
    string;

  nickname:
    string;

  guild?:
    string;

  score?:
    number;
};


type RequestBody = {

  externalEventId:
    string;

  eventType:
    "boss" |
    "war" |
    "etc";

  eventName:
    string;

  description?:
    string;

  occurredAt:
    string;

  baseScore?:
    number;

  countsForAttendance?:
    boolean;

  participants:
    Participant[];
};


// ============================================================
// RESPONSE
// ============================================================

function errorResponse(
  message:
    string,
  status:
    number
) {

  return NextResponse.json(
    {
      success:
        false,

      message,
    },
    {
      status,
    }
  );
}


// ============================================================
// POST
//
// 밍봇 전용
// 사용자 브라우저용 API 아님
// ============================================================

export async function POST(
  request:
    NextRequest
) {

  try {

    // ========================================================
    // 1. 밍봇 인증
    // ========================================================

    const configuredSecret =
      process.env
        .MINGBOT_API_SECRET;


    if (
      !configuredSecret
    ) {

      console.error(
        "MINGBOT_API_SECRET가 설정되지 않았습니다."
      );


      return errorResponse(
        "서버 설정 오류입니다.",
        500
      );
    }


    const receivedSecret =
      request.headers.get(
        "x-mingbot-secret"
      );


    if (
      !receivedSecret ||
      receivedSecret !==
        configuredSecret
    ) {

      return errorResponse(
        "밍봇 인증에 실패했습니다.",
        401
      );
    }


    // ========================================================
    // 2. BODY
    // ========================================================

    let body:
      RequestBody;


    try {

      body =
        await request.json();

    } catch {

      return errorResponse(
        "잘못된 JSON 요청입니다.",
        400
      );
    }


    // ========================================================
    // 3. 기본 검증
    // ========================================================

    const externalEventId =
      String(
        body.externalEventId ||
        ""
      ).trim();


    const eventType =
      String(
        body.eventType ||
        ""
      ).trim();


    const eventName =
      String(
        body.eventName ||
        ""
      ).trim();


    const description =
      String(
        body.description ||
        ""
      ).trim();


    const occurredAt =
      String(
        body.occurredAt ||
        ""
      ).trim();


    const baseScore =
      Number(
        body.baseScore ??
        1
      );


    const countsForAttendance =
      body.countsForAttendance !==
      false;


    const participants =
      Array.isArray(
        body.participants
      )
        ? body.participants
        : [];


    if (
      !externalEventId
    ) {

      return errorResponse(
        "externalEventId가 없습니다.",
        400
      );
    }


    if (
      ![
        "boss",
        "war",
        "etc",
      ].includes(
        eventType
      )
    ) {

      return errorResponse(
        "eventType이 올바르지 않습니다.",
        400
      );
    }


    if (
      !eventName
    ) {

      return errorResponse(
        "이벤트 이름이 없습니다.",
        400
      );
    }


    if (
      !occurredAt ||
      Number.isNaN(
        new Date(
          occurredAt
        ).getTime()
      )
    ) {

      return errorResponse(
        "이벤트 시간이 올바르지 않습니다.",
        400
      );
    }


    if (
      !Number.isFinite(
        baseScore
      )
    ) {

      return errorResponse(
        "점수 값이 올바르지 않습니다.",
        400
      );
    }


    // ========================================================
    // 4. 참여자 정리
    //
    // 동일 Discord ID가 여러 번 들어오면
    // 마지막 값 하나만 사용
    // ========================================================

    const participantMap =
      new Map<
        string,
        {
          discord_id:
            string;

          nickname:
            string;

          guild:
            string;

          score:
            number;
        }
      >();


    for (
      const participant of
      participants
    ) {

      const discordId =
        String(
          participant
            ?.discordId ||
          ""
        ).trim();


      if (
        !discordId
      ) {

        continue;
      }


      const nickname =
        String(
          participant
            ?.nickname ||
          "알 수 없음"
        ).trim();


      const guild =
        String(
          participant
            ?.guild ||
          ""
        ).trim();


      const participantScore =
        Number(
          participant
            ?.score ??
          baseScore
        );


      participantMap.set(
        discordId,
        {

          discord_id:
            discordId,

          nickname:
            nickname ||
            "알 수 없음",

          guild,

          score:
            Number.isFinite(
              participantScore
            )
              ? participantScore
              : baseScore,
        }
      );
    }


    const normalizedParticipants =
      Array.from(
        participantMap.values()
      );


    // ========================================================
    // 5. Supabase RPC
    //
    // 이벤트 1회당 DB 왕복 1회
    // ========================================================

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .rpc(
          "record_mingbot_event",
          {

            p_external_event_id:
              externalEventId,

            p_event_type:
              eventType,

            p_event_name:
              eventName,

            p_description:
              description ||
              null,

            p_occurred_at:
              new Date(
                occurredAt
              ).toISOString(),

            p_base_score:
              baseScore,

            p_counts_for_attendance:
              countsForAttendance,

            p_participants:
              normalizedParticipants,
          }
        );


    if (
      error
    ) {

      console.error(
        "MINGBOT PARTICIPATION RPC ERROR:",
        error
      );


      return errorResponse(
        error.message,
        500
      );
    }


    return NextResponse.json({

      success:
        true,

      event:
        data,
    });


  } catch (
    error
  ) {

    console.error(
      "MINGBOT PARTICIPATION API ERROR:",
      error
    );


    return errorResponse(
      error instanceof Error
        ? error.message
        : "밍봇 참여기록 저장 중 오류가 발생했습니다.",
      500
    );
  }
}