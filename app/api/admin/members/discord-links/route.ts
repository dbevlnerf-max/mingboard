import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


// ============================================================
// 관리자 권한
// ============================================================

async function requireAdmin() {
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
              "로그인이 필요합니다.",
          },
          {
            status: 401,
          }
        ),
    };
  }


  if (
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
              "관리자 권한이 필요합니다.",
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
  };
}


// ============================================================
// 문자열
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
// 숫자
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
// GET
//
// 1) ?gid=12
//    → 특정 GID의 Discord 연결 목록
//
// 2) gid 없음
//    → 전체 GID 연결 개수
// ============================================================

export async function GET(
  request: NextRequest
) {
  const access =
    await requireAdmin();


  if (!access.ok) {
    return access.response;
  }


  try {
    const gidParam =
      request.nextUrl.searchParams.get(
        "gid"
      );


    // ========================================================
    // 특정 GID
    // ========================================================

    if (
      gidParam
    ) {
      const gid =
        Number(
          gidParam
        );


      if (
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
              "올바른 GID가 아닙니다.",
          },
          {
            status: 400,
          }
        );
      }


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
            "gid",
            gid
          )
          .order(
            "created_at",
            {
              ascending:
                true,
            }
          );


      if (
        error
      ) {
        throw error;
      }


      const rows =
        Array.isArray(
          data
        )
          ? data
          : [];


      const sorted =
        [...rows].sort(
          (
            a,
            b
          ) => {
            if (
              a.account_type ===
              "primary"
            ) {
              return -1;
            }


            if (
              b.account_type ===
              "primary"
            ) {
              return 1;
            }


            return 0;
          }
        );


      return NextResponse.json({
        success: true,

        gid:
          String(
            gid
          ),

        count:
          sorted.length,

        max:
          2,

        full:
          sorted.length >=
          2,

        links:
          sorted.map(
            row => ({
              id:
                row.id,

              gid:
                String(
                  row.gid
                ),

              discordId:
                row.discord_id,

              discordUsername:
                row.discord_username,

              discordDisplayName:
                row.discord_display_name,

              accountType:
                row.account_type,

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at,
            })
          ),
      });
    }


    // ========================================================
    // 전체 연결 개수
    // ========================================================

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "get_guild_member_discord_link_counts"
      );


    if (
      error
    ) {
      throw error;
    }


    const rows =
      Array.isArray(
        data
      )
        ? data
        : [];


    return NextResponse.json({
      success: true,

      counts:
        rows.map(
          (
            row:
              any
          ) => ({
            gid:
              stringValue(
                row.gid
              ),

            count:
              numberValue(
                row.link_count
              ),

            max:
              2,

            primaryCount:
              numberValue(
                row.primary_count
              ),

            additionalCount:
              numberValue(
                row.additional_count
              ),

            full:
              numberValue(
                row.link_count
              ) >=
              2,
          })
        ),
    });


  } catch (
    error
  ) {
    console.error(
      "[Discord 연결관리 조회 오류]",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof
          Error
            ? error.message
            : "Discord 연결정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}


// ============================================================
// DELETE
//
// 관리자 Discord 연결 해제
//
// body:
// {
//   discordId: "123456789..."
// }
//
// 현재 단계:
// 1. Supabase 매핑 해제
//
// 다음 단계:
// 2. Zeus Discord 역할 제거
// 3. 보호 페이지/API에서 매핑 검사
// ============================================================

export async function DELETE(
  request: NextRequest
) {
  const access =
    await requireAdmin();


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


    const discordId =
      stringValue(
        body.discordId
      );


    if (
      !discordId
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Discord ID가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // 해제 전 정보
    // ========================================================

    const {
      data:
        existingLink,

      error:
        findError,
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
            account_type
          `
        )
        .eq(
          "discord_id",
          discordId
        )
        .maybeSingle();


    if (
      findError
    ) {
      throw findError;
    }


    if (
      !existingLink
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "연결된 Discord 계정을 찾을 수 없습니다.",
        },
        {
          status: 404,
        }
      );
    }


    // ========================================================
    // Supabase RPC
    //
    // primary 해제 시 남아있는 추가계정을
    // 자동 primary로 승격
    // ========================================================

    const {
      data:
        unlinkResult,

      error:
        unlinkError,
    } =
      await supabaseAdmin.rpc(
        "unlink_guild_member_discord_account",
        {
          p_discord_id:
            discordId,
        }
      );


    if (
      unlinkError
    ) {
      throw unlinkError;
    }


    if (
      unlinkResult &&
      unlinkResult.success ===
      false
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            unlinkResult.message ||
            "Discord 계정 연결 해제에 실패했습니다.",
        },
        {
          status: 400,
        }
      );
    }


    // ========================================================
    // 현재는 DB 연결 해제까지
    //
    // Discord 역할 제거는 다음 단계에서
    // 밍봇/Discord 서버 API와 연결한다.
    // ========================================================

    return NextResponse.json({
      success: true,

      message:
        "Discord 계정 연결을 해제했습니다.",

      removed: {
        gid:
          String(
            existingLink.gid
          ),

        discordId:
          existingLink.discord_id,

        discordUsername:
          existingLink.discord_username,

        discordDisplayName:
          existingLink.discord_display_name,

        accountType:
          existingLink.account_type,
      },

      discordRoleRemoved:
        false,
    });


  } catch (
    error
  ) {
    console.error(
      "[Discord 연결 해제 오류]",
      error
    );


    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof
          Error
            ? error.message
            : "Discord 계정 연결 해제에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}