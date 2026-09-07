import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


// ============================================================
// TYPE
// ============================================================

type GuildMember = {
  gid: string;

  nickname: string;

  job: string;

  growthPower: string;

  growthPowerNumber: number;

  guild: string;

  attendanceRate: string;

  participationCount: number;

  targetCount: number;
};


type LinkCountRow = {
  gid:
    | string
    | number;

  link_count:
    | string
    | number;

  primary_count:
    | string
    | number;

  additional_count:
    | string
    | number;
};


type AccountType =
  | "primary"
  | "sub"
  | "discord_alt";


// ============================================================
// 공통 숫자 변환
// ============================================================

function numberValue(
  value: unknown
) {
  const number =
    Number(
      value ??
      0
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


// ============================================================
// 문자열 정리
// ============================================================

function stringValue(
  value: unknown
) {
  return String(
    value ??
    ""
  ).trim();
}


// ============================================================
// 로그인 검사
//
// 최초 GID 연결 전이므로
// GID 매핑 여부는 검사하면 안 됨.
//
// Discord 서버 소속 + Zeus 역할까지만 확인.
// ============================================================

async function requireDiscordLogin() {
  const session =
    await auth();


  if (
    !session?.user
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,

            message:
              "Discord 로그인이 필요합니다.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  const discordId =
    stringValue(
      session.user.discordId
    );


  if (!discordId) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,

            message:
              "Discord ID를 확인할 수 없습니다. 다시 로그인해주세요.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  if (
    session.user.isGuildMember ===
    false
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,

            message:
              "Discord 길드에 가입되어 있지 않습니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }


  if (
    session.user.hasZeusRole ===
      false &&
    !session.user.isAdmin &&
    !session.user.isMaster
  ) {
    return {
      ok:
        false as const,

      response:
        NextResponse.json(
          {
            success: false,

            message:
              "밍보드 이용 역할이 없습니다.",
          },
          {
            status: 403,
          }
        ),
    };
  }


  return {
    ok:
      true as const,

    session,

    discordId,
  };
}


// ============================================================
// Google Apps Script
// 🧾길드현황 조회
// ============================================================

async function getGuildMembers():
  Promise<GuildMember[]> {

  const baseUrl =
    process.env
      .GOOGLE_SCRIPT_URL;


  if (!baseUrl) {
    throw new Error(
      "GOOGLE_SCRIPT_URL이 설정되지 않았습니다."
    );
  }


  const separator =
    baseUrl.includes("?")
      ? "&"
      : "?";


  const response =
    await fetch(
      `${baseUrl}${separator}action=guild`,
      {
        method:
          "GET",

        cache:
          "no-store",

        redirect:
          "follow",
      }
    );


  const text =
    await response.text();


  let data:
    any;


  try {
    data =
      JSON.parse(
        text
      );

  } catch {
    throw new Error(
      "길드현황 데이터를 읽지 못했습니다."
    );
  }


  if (
    !response.ok ||
    !data.success
  ) {
    throw new Error(
      data.message ||
      "길드현황 조회에 실패했습니다."
    );
  }


  const sourceRows =
    data.members ??
    data.rows ??
    data.data ??
    [];


  if (
    !Array.isArray(
      sourceRows
    )
  ) {
    return [];
  }


  return sourceRows
    .map(
      (
        member:
          any
      ) => {
        const gid =
          stringValue(
            member.gid ??
            member.GID
          );


        const nickname =
          stringValue(
            member.nickname ??
            member.currentNickname ??
            member.current_nickname ??
            member["현닉네임"]
          );


        return {
          gid,

          nickname,

          job:
            stringValue(
              member.job ??
              member["직업"]
            ),

          growthPower:
            stringValue(
              member.growthPower ??
              member.growth_power ??
              member["성장력"]
            ),

          growthPowerNumber:
            numberValue(
              member.growthPowerNumber ??
              member.growth_power_number ??
              member["성장력"]
            ),

          guild:
            stringValue(
              member.guild ??
              member["길드"]
            ),

          attendanceRate:
            stringValue(
              member.attendanceRate ??
              member.attendance_rate ??
              member["참석률"]
            ),

          participationCount:
            numberValue(
              member.participationCount ??
              member.participation_count ??
              member["참여횟수"]
            ),

          targetCount:
            numberValue(
              member.targetCount ??
              member.target_count ??
              member["대상횟수"]
            ),
        };
      }
    )
    .filter(
      (
        member:
          GuildMember
      ) =>
        member.gid &&
        member.nickname
    );
}


// ============================================================
// 현재 Discord 계정 연결정보
// ============================================================

async function getMyDiscordLink(
  discordId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "guild_member_discord_links"
      )
      .select(
        `
          id,
          gid,
          discord_id,
          discord_username,
          discord_display_name,
          account_type,
          created_at,
          updated_at
        `
      )
      .eq(
        "discord_id",
        discordId
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  return data;
}


// ============================================================
// GID별 연결 개수
// ============================================================

async function getLinkCounts() {
  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      "get_guild_member_discord_link_counts"
    );


  if (error) {
    throw error;
  }


  return (
    Array.isArray(
      data
    )
      ? data
      : []
  ) as LinkCountRow[];
}


// ============================================================
// 연결된 GID의 실제 길드원 정보
// ============================================================

function findMemberByGid(
  members: GuildMember[],
  gid: unknown
) {
  const target =
    stringValue(
      gid
    );


  return (
    members.find(
      member =>
        member.gid ===
        target
    ) ??
    null
  );
}


// ============================================================
// GET
//
// 현재 연결 상태 +
// 🧾길드현황 전체 목록 +
// 각 GID 연결수 반환
// ============================================================

export async function GET() {
  const access =
    await requireDiscordLogin();


  if (!access.ok) {
    return access.response;
  }


  try {
    const [
      members,
      myLink,
      countRows,
    ] =
      await Promise.all([
        getGuildMembers(),

        getMyDiscordLink(
          access.discordId
        ),

        getLinkCounts(),
      ]);


    // ========================================================
    // 연결수 Map
    // ========================================================

    const countMap =
      new Map<
        string,
        {
          count: number;
          primaryCount: number;
          additionalCount: number;
        }
      >();


    for (
      const row
      of countRows
    ) {
      const gid =
        stringValue(
          row.gid
        );


      if (!gid) {
        continue;
      }


      countMap.set(
        gid,
        {
          count:
            numberValue(
              row.link_count
            ),

          primaryCount:
            numberValue(
              row.primary_count
            ),

          additionalCount:
            numberValue(
              row.additional_count
            ),
        }
      );
    }


    // ========================================================
    // 사용자에게 보여줄 길드원 목록
    // ========================================================

    const memberRows =
      members.map(
        member => {
          const counts =
            countMap.get(
              member.gid
            ) ?? {
              count: 0,
              primaryCount: 0,
              additionalCount: 0,
            };


          return {
            ...member,

            discordLinkCount:
              counts.count,

            discordLinkMax:
              2,

            primaryCount:
              counts.primaryCount,

            additionalCount:
              counts.additionalCount,

            full:
              counts.count >=
              2,

            // 0/2
            canPrimary:
              counts.count ===
              0,

            // 1/2
            canAdditional:
              counts.count ===
              1,
          };
        }
      );


    // ========================================================
    // 현재 계정이 이미 연결되어 있으면
    // GID의 현재 길드원 정보도 반환
    // ========================================================

    const linkedMember =
      myLink
        ? findMemberByGid(
            members,
            myLink.gid
          )
        : null;


    return NextResponse.json({
      success: true,

      discord: {
        id:
          access.discordId,

        username:
          sessionName(
            access.session.user
          ),
      },

      linked:
        Boolean(
          myLink
        ),

      myLink:
        myLink
          ? {
              id:
                myLink.id,

              gid:
                String(
                  myLink.gid
                ),

              discordId:
                myLink.discord_id,

              discordUsername:
                myLink.discord_username,

              discordDisplayName:
                myLink.discord_display_name,

              accountType:
                myLink.account_type,

              createdAt:
                myLink.created_at,

              updatedAt:
                myLink.updated_at,

              member:
                linkedMember,
            }
          : null,

      members:
        memberRows,
    });


  } catch (
    error
  ) {
    console.error(
      "[계정연결 조회 오류]",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof
          Error
            ? error.message
            : "계정 연결 정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// POST
//
// 게임 길드원(GID) ↔ 현재 Discord 로그인 계정 연결
//
// body:
//
// 첫 번째:
// {
//   "gid": "12"
// }
//
// 두 번째:
// {
//   "gid": "12",
//   "additional": true,
//   "accountType": "sub"
// }
//
// 또는
//
// {
//   "gid": "12",
//   "additional": true,
//   "accountType": "discord_alt"
// }
// ============================================================

export async function POST(
  request: NextRequest
) {
  const access =
    await requireDiscordLogin();


  if (!access.ok) {
    return access.response;
  }


  try {
    const body =
      await request
        .json()
        .catch(
          () => ({})
        );


    const gidText =
      stringValue(
        body.gid
      );


    const gid =
      Number(
        gidText
      );


    if (
      !gidText ||
      !Number.isSafeInteger(
        gid
      ) ||
      gid <=
      0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "올바른 길드원을 선택해주세요.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // 현재 Discord 계정이 이미 연결되어 있는지
    // ========================================================

    const existingMyLink =
      await getMyDiscordLink(
        access.discordId
      );


    if (
      existingMyLink
    ) {
      return NextResponse.json(
        {
          success: false,

          alreadyLinked:
            true,

          message:
            "이 Discord 계정은 이미 게임 계정에 연결되어 있습니다.",
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // 선택한 GID가 실제 🧾길드현황에 존재하는지 확인
    //
    // 클라이언트가 임의의 GID를 보내는 것 방지
    // ========================================================

    const members =
      await getGuildMembers();


    const selectedMember =
      findMemberByGid(
        members,
        gid
      );


    if (
      !selectedMember
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "🧾길드현황에서 해당 길드원을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // 현재 GID 연결수 조회
    // ========================================================

    const {
      data:
        existingLinks,

      error:
        existingLinksError,
    } =
      await supabaseAdmin
        .from(
          "guild_member_discord_links"
        )
        .select(
          `
            id,
            account_type
          `
        )
        .eq(
          "gid",
          gid
        );


    if (
      existingLinksError
    ) {
      throw existingLinksError;
    }


    const currentCount =
      Array.isArray(
        existingLinks
      )
        ? existingLinks.length
        : 0;


    // ========================================================
    // 2/2
    // ========================================================

    if (
      currentCount >=
      2
    ) {
      return NextResponse.json(
        {
          success: false,

          full:
            true,

          message:
            `${selectedMember.nickname}님은 이미 Discord 계정이 2/2 연결되어 있습니다.`,
        },
        {
          status: 409,
        }
      );
    }


    // ========================================================
    // account_type 결정
    // ========================================================

    let accountType:
      AccountType;


    // --------------------------------------------------------
    // 첫 계정
    // --------------------------------------------------------

    if (
      currentCount ===
      0
    ) {
      accountType =
        "primary";


    // --------------------------------------------------------
    // 두 번째 계정
    // --------------------------------------------------------

    } else {
      const additional =
        body.additional ===
        true;


      const requestedType =
        stringValue(
          body.accountType
        );


      if (
        !additional
      ) {
        return NextResponse.json(
          {
            success: false,

            requiresAdditional:
              true,

            message:
              "이미 본계정이 연결되어 있습니다. 추가입력을 선택해주세요.",
          },
          {
            status: 400,
          }
        );
      }


      if (
        requestedType !==
          "sub" &&
        requestedType !==
          "discord_alt"
      ) {
        return NextResponse.json(
          {
            success: false,

            requiresAdditional:
              true,

            message:
              "추가 계정 유형을 부주 또는 디코부계정으로 선택해주세요.",
          },
          {
            status: 400,
          }
        );
      }


      accountType =
        requestedType;
    }


    // ========================================================
    // Discord 로그인 정보
    // ========================================================

    const discordName =
      sessionName(
        access.session.user
      );


    // ========================================================
    // Supabase RPC 저장
    // ========================================================

    const {
      data:
        linkedData,

      error:
        linkedError,
    } =
      await supabaseAdmin.rpc(
        "link_guild_member_discord_account",
        {
          p_gid:
            gid,

          p_discord_id:
            access.discordId,

          p_discord_username:
            discordName,

          p_discord_display_name:
            discordName,

          p_account_type:
            accountType,
        }
      );


    if (
      linkedError
    ) {
      throw linkedError;
    }


    // ========================================================
    // 성공
    // ========================================================

    return NextResponse.json({
      success: true,

      message:
        currentCount ===
        0
          ? `${selectedMember.nickname} 본계정으로 연결했습니다.`
          : accountType ===
            "sub"
            ? `${selectedMember.nickname} 부주 계정으로 연결했습니다.`
            : `${selectedMember.nickname} 디코부계정으로 연결했습니다.`,

      link: {
        gid:
          selectedMember.gid,

        nickname:
          selectedMember.nickname,

        guild:
          selectedMember.guild,

        job:
          selectedMember.job,

        growthPower:
          selectedMember.growthPower,

        discordId:
          access.discordId,

        discordUsername:
          discordName,

        accountType,

        raw:
          linkedData,
      },
    });


  } catch (
    error
  ) {
    console.error(
      "[Discord 계정 연결 오류]",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof
          Error
            ? error.message
            : "Discord 계정 연결에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// SESSION 표시명
//
// NextAuth의 session.user.name을 Discord 로그인명으로 사용.
// 값이 없는 경우 Discord ID를 표시.
// ============================================================

function sessionName(
  user: {
    name?:
      | string
      | null;

    discordId?:
      | string
      | null;
  }
) {
  const name =
    stringValue(
      user.name
    );


  if (name) {
    return name;
  }


  return stringValue(
    user.discordId
  );
}