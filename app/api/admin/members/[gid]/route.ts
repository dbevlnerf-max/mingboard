import {
  NextResponse,
} from "next/server";

import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { setMemberLifecycleStatus } from "@/lib/member-lifecycle";

type RouteContext = {
  params: Promise<{ gid: string }>;
};

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

async function checkAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { ok: false, status: 401, message: "로그인이 필요합니다.", session: null };
  }

  if (!session.user.isAdmin && !session.user.isMaster) {
    return { ok: false, status: 403, message: "관리자 권한이 필요합니다.", session };
  }

  if (!session.user.isMaster && !session.user.hasZeusRole) {
    return { ok: false, status: 403, message: "활성 길드원 인증이 필요합니다.", session };
  }

  return { ok: true, status: 200, message: "", session };
}

async function getCurrentMember(
  googleScriptUrl: string,
  gid: string
): Promise<GuildMember | null> {
  try {
    const response = await fetch(`${googleScriptUrl}?action=guild`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.members)) return null;
    return data.members.find((member: GuildMember) => String(member.gid) === String(gid)) || null;
  } catch (error) {
    console.error("CURRENT MEMBER ERROR:", error);
    return null;
  }
}

async function callGoogleScript(payload: Record<string, unknown>) {
  const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GUILD_WRITE_SECRET;

  if (!googleScriptUrl || !secret) {
    return { success: false, message: "Google Sheet 연동 설정이 없습니다." };
  }

  try {
    const response = await fetch(googleScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, secret }),
      cache: "no-store",
    });
    const data = await response.json();
    return {
      success: response.ok && Boolean(data.success),
      message: data.message || "",
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Google Sheet 동기화 실패",
    };
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await checkAdmin();
    if (!authResult.ok || !authResult.session) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: authResult.status }
      );
    }

    const { gid } = await context.params;
    const cleanGid = String(gid).trim();
    const body = await request.json();
    const nickname = String(body.nickname || "").trim();
    const job = String(body.job || "").trim();
    const growthPower = String(body.growthPower || "").replace(/,/g, "").trim();
    const guild = String(body.guild || "").trim();
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;

    if (!googleScriptUrl) {
      return NextResponse.json(
        { success: false, message: "Google Sheet 연동 설정이 없습니다." },
        { status: 500 }
      );
    }

    const beforeMember = await getCurrentMember(googleScriptUrl, cleanGid);
    if (!beforeMember) {
      return NextResponse.json(
        { success: false, message: "수정 전 길드원 정보를 찾지 못했습니다." },
        { status: 404 }
      );
    }

    const sheetResult = await callGoogleScript({
      action: "updateGuildMember",
      gid: cleanGid,
      nickname,
      job,
      growthPower,
      guild,
    });

    if (!sheetResult.success) {
      return NextResponse.json(
        { success: false, message: sheetResult.message || "길드원 수정 실패" },
        { status: 400 }
      );
    }

    await writeAuditLog({
      action: "UPDATE",
      targetType: "guild_member",
      targetId: cleanGid,
      targetName: nickname,
      actorDiscordId: String(authResult.session.user.discordId || ""),
      actorName: authResult.session.user.name || "관리자",
      actorRole: authResult.session.user.isMaster ? "MASTER" : "ADMIN",
      beforeData: beforeMember,
      afterData: { gid: cleanGid, nickname, job, growthPower: Number(growthPower), guild },
      description: `${nickname} 길드원 정보 수정`,
    });

    return NextResponse.json({ success: true, message: "길드원 정보를 수정했습니다." });
  } catch (error) {
    console.error("UPDATE MEMBER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "길드원 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 기존 UI의 DELETE 호출을 유지하되 의미는 물리 삭제가 아닌 탈퇴처리입니다.
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authResult = await checkAdmin();
    if (!authResult.ok || !authResult.session) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: authResult.status }
      );
    }

    const { gid } = await context.params;
    const cleanGid = String(gid).trim();
    const googleScriptUrl = process.env.GOOGLE_SCRIPT_URL;

    if (!googleScriptUrl) {
      return NextResponse.json(
        { success: false, message: "Google Sheet 연동 설정이 없습니다." },
        { status: 500 }
      );
    }

    const beforeMember = await getCurrentMember(googleScriptUrl, cleanGid);
    if (!beforeMember) {
      return NextResponse.json(
        { success: false, message: "탈퇴 처리할 길드원 정보를 찾지 못했습니다." },
        { status: 404 }
      );
    }

    const lifecycle = await setMemberLifecycleStatus({
      gid: cleanGid,
      status: "left",
      actorDiscordId: String(authResult.session.user.discordId || ""),
      reason: "admin_member_leave",
    });

    const sheetResult = await callGoogleScript({
      action: "setGuildMemberStatus",
      gid: cleanGid,
      status: "left",
    });

    const failedRoles = lifecycle.roleResults.filter(result => !result.success);

    await writeAuditLog({
      action: "UPDATE",
      targetType: "guild_member_status",
      targetId: cleanGid,
      targetName: beforeMember.nickname,
      actorDiscordId: String(authResult.session.user.discordId || ""),
      actorName: authResult.session.user.name || "관리자",
      actorRole: authResult.session.user.isMaster ? "MASTER" : "ADMIN",
      beforeData: beforeMember,
      afterData: {
        status: "left",
        linksRevoked: lifecycle.linksRevoked,
        roleResults: lifecycle.roleResults,
        sheetSynced: sheetResult.success,
      },
      description: `${beforeMember.nickname} 길드원 탈퇴처리`,
    });

    return NextResponse.json({
      success: true,
      message: `${beforeMember.nickname}님을 탈퇴 처리했습니다.`,
      status: "left",
      linksRevoked: lifecycle.linksRevoked,
      discordRoleRemoved: failedRoles.length === 0,
      roleResults: lifecycle.roleResults,
      sheetSynced: sheetResult.success,
      warning: [
        !sheetResult.success ? `Google Sheet 상태 반영 실패: ${sheetResult.message}` : null,
        failedRoles.length > 0
          ? `Discord 역할 회수 ${failedRoles.length}건 실패. 밍보드 접근은 이미 차단됐습니다.`
          : null,
      ].filter(Boolean).join(" / ") || null,
    });
  } catch (error) {
    console.error("LEAVE MEMBER ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "길드원 탈퇴처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
