import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberStatus } from "@/lib/member-lifecycle";

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

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const valueNumber = Number(value ?? 0);
  return Number.isFinite(valueNumber) ? valueNumber : 0;
}

function sessionName(
  user: { name?: string | null } | undefined
) {
  return String(user?.name || "").trim();
}

async function requireDiscordLogin() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Discord 로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  const discordId = stringValue(session.user.discordId);

  if (!discordId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Discord ID를 확인할 수 없습니다." },
        { status: 401 }
      ),
    };
  }

  if (!session.user.isGuildMember) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          code: "NOT_IN_DISCORD_GUILD",
          message: "게임하는밍쨩 Discord 서버 가입이 필요합니다.",
        },
        { status: 403 }
      ),
    };
  }

  if (!session.user.discordHasZeusRole && !session.user.isMaster) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          code: "ZEUS_ROLE_REQUIRED",
          message: "제우스 역할 인증이 필요합니다.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true as const, session, discordId };
}

async function getGuildMembers(): Promise<GuildMember[]> {
  const baseUrl = process.env.GOOGLE_SCRIPT_URL;

  if (!baseUrl) {
    throw new Error("GOOGLE_SCRIPT_URL이 설정되지 않았습니다.");
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${baseUrl}${separator}action=guild`, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "길드현황 조회에 실패했습니다.");
  }

  const sourceRows = data.members ?? data.rows ?? data.data ?? [];
  if (!Array.isArray(sourceRows)) return [];

  return sourceRows
    .map((member: any) => ({
      gid: stringValue(member.gid ?? member.GID),
      nickname: stringValue(member.nickname ?? member.currentNickname ?? member.current_nickname ?? member["현닉네임"]),
      job: stringValue(member.job ?? member["직업"]),
      growthPower: stringValue(member.growthPower ?? member.growth_power ?? member["성장력"]),
      growthPowerNumber: numberValue(member.growthPowerNumber ?? member.growth_power_number ?? member["성장력"]),
      guild: stringValue(member.guild ?? member["길드"]),
      attendanceRate: stringValue(member.attendanceRate ?? member.attendance_rate ?? member["참석률"]),
      participationCount: numberValue(member.participationCount ?? member.participation_count ?? member["참여횟수"]),
      targetCount: numberValue(member.targetCount ?? member.target_count ?? member["대상횟수"]),
    }))
    .filter(member => member.gid && member.nickname);
}

async function getActiveLink(discordId: string) {
  const { data, error } = await supabaseAdmin
    .from("guild_member_discord_links")
    .select("id, gid, discord_id, discord_username, discord_display_name, account_type, created_at, updated_at, revoked_at, revoke_reason")
    .eq("discord_id", discordId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getAnyLink(discordId: string) {
  const { data, error } = await supabaseAdmin
    .from("guild_member_discord_links")
    .select("id, gid, discord_id, account_type, revoked_at, revoke_reason")
    .eq("discord_id", discordId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getActiveLinks() {
  const { data, error } = await supabaseAdmin
    .from("guild_member_discord_links")
    .select("gid, account_type")
    .is("revoked_at", null);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function findMemberByGid(members: GuildMember[], gid: unknown) {
  const target = stringValue(gid);
  return members.find(member => member.gid === target) ?? null;
}

export async function GET() {
  const access = await requireDiscordLogin();
  if (!access.ok) return access.response;

  try {
    const [members, myLink, activeLinks] = await Promise.all([
      getGuildMembers(),
      getActiveLink(access.discordId),
      getActiveLinks(),
    ]);

    const countMap = new Map<string, { count: number; primaryCount: number; additionalCount: number }>();
    for (const row of activeLinks) {
      const gid = stringValue(row.gid);
      if (!gid) continue;
      const current = countMap.get(gid) || { count: 0, primaryCount: 0, additionalCount: 0 };
      current.count += 1;
      if (row.account_type === "primary") current.primaryCount += 1;
      else current.additionalCount += 1;
      countMap.set(gid, current);
    }

    const selectableMembers: GuildMember[] = [];
    for (const member of members) {
      if ((await getMemberStatus(member.gid)) === "active") {
        selectableMembers.push(member);
      }
    }

    const memberRows = selectableMembers.map(member => {
      const counts = countMap.get(member.gid) || { count: 0, primaryCount: 0, additionalCount: 0 };
      return {
        ...member,
        discordLinkCount: counts.count,
        discordLinkMax: 2,
        primaryCount: counts.primaryCount,
        additionalCount: counts.additionalCount,
        full: counts.count >= 2,
        canPrimary: counts.count === 0,
        canAdditional: counts.count === 1,
      };
    });

    const linkedMember = myLink ? findMemberByGid(selectableMembers, myLink.gid) : null;

    return NextResponse.json({
      success: true,
      discord: { id: access.discordId, username: sessionName(access.session.user) },
      linked: Boolean(myLink && linkedMember),
      myLink: myLink && linkedMember ? {
        id: myLink.id,
        gid: String(myLink.gid),
        discordId: myLink.discord_id,
        discordUsername: myLink.discord_username,
        discordDisplayName: myLink.discord_display_name,
        accountType: myLink.account_type,
        createdAt: myLink.created_at,
        updatedAt: myLink.updated_at,
        member: linkedMember,
      } : null,
      members: memberRows,
    });
  } catch (error) {
    console.error("[계정연결 조회 오류]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "계정 연결 정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireDiscordLogin();
  if (!access.ok) return access.response;

  try {
    const body = await request.json().catch(() => ({}));
    const gidText = stringValue(body.gid);
    const gid = Number(gidText);

    if (!gidText || !Number.isSafeInteger(gid) || gid <= 0) {
      return NextResponse.json({ success: false, message: "올바른 길드원을 선택해주세요." }, { status: 400 });
    }

    if ((await getMemberStatus(gid)) !== "active") {
      return NextResponse.json(
        { success: false, code: "MEMBER_NOT_ACTIVE", message: "탈퇴 또는 차단된 캐릭터는 선택할 수 없습니다." },
        { status: 409 }
      );
    }

    const existing = await getAnyLink(access.discordId);
    if (existing && !existing.revoked_at) {
      return NextResponse.json(
        { success: false, alreadyLinked: true, message: "이 Discord 계정은 이미 게임 캐릭터에 연결되어 있습니다." },
        { status: 409 }
      );
    }

    if (existing && (existing.revoke_reason === "member_left" || existing.revoke_reason === "member_banned")) {
      return NextResponse.json(
        {
          success: false,
          code: existing.revoke_reason === "member_banned" ? "BANNED_HISTORY" : "REJOIN_REVIEW_REQUIRED",
          reviewRequired: true,
          message: existing.revoke_reason === "member_banned"
            ? "차단 이력이 있어 자동 인증할 수 없습니다."
            : "과거 탈퇴 이력이 있어 운영진 재가입 승인이 필요합니다.",
        },
        { status: 403 }
      );
    }

    const members = await getGuildMembers();
    const selectedMember = findMemberByGid(members, gid);
    if (!selectedMember) {
      return NextResponse.json(
        { success: false, message: "현재 활동중인 길드원 목록에서 선택한 캐릭터를 찾지 못했습니다." },
        { status: 404 }
      );
    }

    const { data: gidLinks, error: gidLinkError } = await supabaseAdmin
      .from("guild_member_discord_links")
      .select("id, account_type")
      .eq("gid", gid)
      .is("revoked_at", null);
    if (gidLinkError) throw gidLinkError;

    const activeCount = Array.isArray(gidLinks) ? gidLinks.length : 0;
    if (activeCount >= 2) {
      return NextResponse.json(
        { success: false, code: "LINK_LIMIT", message: "이 캐릭터에는 이미 Discord 계정 2개가 연결되어 있습니다." },
        { status: 409 }
      );
    }

    const accountType = activeCount === 0 ? "primary" : body.accountType === "sub" ? "sub" : "discord_alt";
    const linkPayload = {
      gid,
      discord_id: access.discordId,
      discord_username: sessionName(access.session.user),
      discord_display_name: sessionName(access.session.user),
      account_type: accountType,
      revoked_at: null,
      revoke_reason: null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin.from("guild_member_discord_links").update(linkPayload).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("guild_member_discord_links").insert(linkPayload);
      if (error) throw error;
    }

    await supabaseAdmin.from("member_access_history").insert({
      gid,
      discord_id: access.discordId,
      action: "account_linked",
      detail: JSON.stringify({ accountType }),
    });

    return NextResponse.json({
      success: true,
      message: `${selectedMember.nickname} 캐릭터와 Discord 계정을 연결했습니다.`,
      gid: String(gid),
      accountType,
    });
  } catch (error) {
    console.error("[계정연결 저장 오류]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "계정 연결에 실패했습니다." },
      { status: 500 }
    );
  }
}
