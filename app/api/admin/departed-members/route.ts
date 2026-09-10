import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  auth,
} from "@/auth";

import {
  writeAuditLog,
} from "@/lib/audit";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


async function requireAdmin() {
  const session =
    await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "로그인이 필요합니다.",
        },
        { status: 401 }
      ),
    };
  }

  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole ||
    (!session.user.isAdmin && !session.user.isMaster)
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "관리자 권한이 필요합니다.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}


async function fetchDepartedMembers() {
  const googleScriptUrl =
    process.env.GOOGLE_SCRIPT_URL;

  if (!googleScriptUrl) {
    throw new Error(
      "GOOGLE_SCRIPT_URL이 설정되지 않았습니다."
    );
  }

  const separator =
    googleScriptUrl.includes("?") ? "&" : "?";

  const response = await fetch(
    `${googleScriptUrl}${separator}action=guildDeparted`,
    { cache: "no-store" }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message ||
      "탈퇴 인원 정보를 불러오지 못했습니다."
    );
  }

  return Array.isArray(data.members)
    ? data.members
    : [];
}


export async function GET() {
  const access = await requireAdmin();

  if (!access.ok) {
    return access.response;
  }

  try {
    const members =
      await fetchDepartedMembers();

    return NextResponse.json({
      success: true,
      count: members.length,
      members,
    });

  } catch (error) {
    console.error(
      "DEPARTED MEMBERS GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "탈퇴 인원 정보를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}


export async function DELETE(
  request: NextRequest
) {
  const access = await requireAdmin();

  if (!access.ok) {
    return access.response;
  }

  try {
    const body = await request
      .json()
      .catch(() => ({}));

    const gid = String(
      body.gid || ""
    ).trim();

    const confirmNickname = String(
      body.confirmNickname || ""
    ).trim();

    const numericGid = Number(gid);

    if (
      !Number.isSafeInteger(numericGid) ||
      numericGid <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "올바른 GID가 아닙니다.",
        },
        { status: 400 }
      );
    }

    const members =
      await fetchDepartedMembers();

    const member = members.find(
      item =>
        String(item?.gid || "") === gid
    );

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          message:
            "탈퇴 인원 목록에서 해당 길드원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const nickname = String(
      member.nickname || ""
    ).trim();

    if (
      !nickname ||
      confirmNickname !== nickname
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "영구삭제 확인을 위해 닉네임을 정확히 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const googleScriptUrl =
      process.env.GOOGLE_SCRIPT_URL;

    const secret =
      process.env.GUILD_WRITE_SECRET;

    if (!googleScriptUrl || !secret) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Google Sheet 연동 설정이 없습니다.",
        },
        { status: 500 }
      );
    }

    const sheetResponse = await fetch(
      googleScriptUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "permanentDeleteGuildMember",
          secret,
          gid,
        }),
        cache: "no-store",
      }
    );

    const sheetData =
      await sheetResponse.json();

    if (
      !sheetResponse.ok ||
      !sheetData.success
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            sheetData.message ||
            "Google Sheet 영구삭제에 실패했습니다.",
        },
        { status: 400 }
      );
    }

    let stateWarning: string | null = null;

    const { error: stateDeleteError } =
      await supabaseAdmin
        .from("guild_member_states")
        .delete()
        .eq("gid", numericGid);

    if (stateDeleteError) {
      stateWarning =
        `Supabase 상태 레코드 정리 실패: ${stateDeleteError.message}`;
    }

    const auditResult =
      await writeAuditLog({
        action: "DELETE",
        targetType: "guild_member_permanent",
        targetId: gid,
        targetName: nickname,
        actorDiscordId: String(
          access.session.user.discordId || ""
        ),
        actorName:
          access.session.user.name || "관리자",
        actorRole:
          access.session.user.isMaster
            ? "MASTER"
            : "ADMIN",
        beforeData: {
          ...member,
        },
        afterData: null,
        description:
          `${nickname} 탈퇴 인원 영구삭제`,
      });

    const warnings = [
      stateWarning,
      auditResult.success
        ? null
        : auditResult.message,
    ].filter(Boolean);

    return NextResponse.json({
      success: true,
      message:
        `${nickname}님의 길드원 정보를 영구삭제했습니다.`,
      historyPreserved: true,
      warning:
        warnings.length > 0
          ? warnings.join(" / ")
          : null,
    });

  } catch (error) {
    console.error(
      "DEPARTED MEMBER DELETE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "영구삭제 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
