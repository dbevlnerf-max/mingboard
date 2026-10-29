import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberAccess } from "@/lib/guild-scoped-admin";
import { invalidatePortalSheetReads } from "@/lib/sheet-read";
import { writeAuditLog } from "@/lib/audit";
import { archiveCuratedMember } from "@/lib/curated-roster-archive";
import { setMemberLifecycleStatus } from "@/lib/member-lifecycle";

type Context = { params: Promise<{ gid: string }> };
type Member = { gid: string | number; nickname: string; guild: string; job: string;
  growthPower: string; growthPowerNumber: number; [key: string]: unknown };
async function findWritable(gid: string) {
  const session = await auth();
  const access = await getMemberAccess(session?.user);
  if (access.kind === "denied") return { error: "권한이 없습니다.", status: 403 } as const;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return { error: "길드 설정 오류", status: 500 } as const;
  const { data, error } = await supabaseAdmin.from("portal_sheet_snapshots")
    .select("payload,fetched_at").eq("guild_id", guildId)
    .eq("source_key", "manual-guild-roster").eq("query_key", "v1").maybeSingle();
  if (error || !data || data.payload?.mode !== "authoritative" || !Array.isArray(data.payload.members))
    return { error: "승인된 길드원 명단을 확인할 수 없습니다.", status: 503 } as const;
  const member: Member | undefined = data.payload.members.find((m: Member) => String(m.gid) === gid);
  if (!member) return { error: "활동 길드원을 찾을 수 없습니다.", status: 404 } as const;
  if (access.kind === "scoped" && member.guild !== access.guild)
    return { error: "다른 길드의 길드원은 수정하거나 탈퇴시킬 수 없습니다.", status: 403 } as const;
  return { session: session!, access, data, member, guildId } as const;
}

export async function PATCH(request: Request, context: Context) {
  const { gid } = await context.params;
  if (!/^\d+$/.test(gid)) return NextResponse.json({ success: false, message: "GID 오류" }, { status: 400 });
  const check = await findWritable(gid);
  if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });
  const body = await request.json().catch(() => ({}));
  const job = String(body.job ?? "").trim();
  const power = String(body.growthPower ?? "").replace(/,/g, "").trim();
  if (!job || job.length > 40 || !/^\d{1,9}$/.test(power) || Number(power) < 1)
    return NextResponse.json({ success: false, message: "직업과 유효한 성장력을 입력해주세요." }, { status: 400 });
  // The member's GID is immutable. Delegated guild managers may change
  // nickname, job and growth power only for their own assigned guild.
  if (check.access.kind === "scoped" &&
      String(body.guild ?? check.member.guild).trim() !== check.member.guild)
    return NextResponse.json({ success: false,
      message: "길드 담당자는 소속 길드를 변경할 수 없습니다." }, { status: 403 });
  const expectedNickname = String(body.expectedNickname ?? check.member.nickname).trim();
  if (expectedNickname !== check.member.nickname)
    return NextResponse.json({ success: false,
      message: "다른 관리자가 닉네임을 수정했습니다. 새로고침 후 다시 시도해주세요." }, { status: 409 });
  const nickname = String(body.nickname ?? check.member.nickname).trim();
  const guild = check.access.kind === "full"
    ? String(body.guild ?? check.member.guild).trim() : check.member.guild;
  if (!nickname || [...nickname].length > 24 ||
      /[\u0000-\u001f\u007f]/u.test(nickname) ||
      !["핑뚝","천제","아스가르드","지옥소녀"].includes(guild))
    return NextResponse.json({ success: false,
      message: "닉네임(1~24자) 또는 소속 길드를 확인해주세요." }, { status: 400 });

  const normalizedNickname = nickname.normalize("NFKC").toLocaleLowerCase("ko-KR");
  const nameConflict = check.data.payload.members.some((member: Member) =>
    String(member.gid) !== gid &&
    String(member.nickname || "").trim().normalize("NFKC")
      .toLocaleLowerCase("ko-KR") === normalizedNickname
  );
  if (nameConflict)
    return NextResponse.json({ success: false,
      message: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요." }, { status: 409 });
  const renamed = nickname !== check.member.nickname;

  // Restore the existing source-of-truth write-through. The legacy manager
  // previously called this Apps Script action; delegated managers must not
  // silently update Supabase while leaving Google Sheets unchanged.
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const writeSecret = process.env.GUILD_WRITE_SECRET;
  if (!scriptUrl || !writeSecret) {
    return NextResponse.json({
      success: false, sheetSynced: false,
      message: "원본 Google Sheets 연동 설정이 없어 저장하지 않았습니다.",
    }, { status: 503 });
  }

  let sheetResult: {
    success?: boolean;
    message?: string;
    member?: { gid?: string | number };
  };
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateGuildMember",
        secret: writeSecret, gid, nickname, job,
        growthPower: power, guild,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    sheetResult = await response.json();
    if (!response.ok || !sheetResult?.success ||
        (sheetResult.member?.gid && String(sheetResult.member.gid) !== gid)) {
      const oldScript = /핑뚝.{0,20}빨뚝.{0,20}검뚝/.test(String(sheetResult?.message || ""));
      return NextResponse.json({
        success: false, sheetSynced: false,
        code: oldScript ? "SHEET_SCRIPT_OUTDATED" : "SHEET_WRITE_FAILED",
        message: oldScript
          ? "원본 구글시트의 Apps Script가 이전 길드(핑뚝·빨뚝·검뚝)만 허용하는 구버전입니다. Apps Script의 isValidGuild를 4개 길드로 변경한 뒤 기존 웹앱을 새 버전으로 재배포해야 합니다. 밍보드에는 저장하지 않았습니다."
          : sheetResult?.message || "원본 Google Sheets 저장에 실패했습니다. 변경 사항은 반영하지 않았습니다.",
      }, { status: 502 });
    }
  } catch {
    return NextResponse.json({
      success: false, sheetSynced: false,
      message: "Google Sheets 연결에 실패했습니다. 원본 저장 여부를 확인한 뒤 다시 시도해주세요.",
    }, { status: 502 });
  }

  // Write the portal snapshot only after the original Sheet acknowledges the
  // update. Use optimistic concurrency to preserve unrelated admin writes.
  // A successful Sheet write must also remove the stale-source override: the
  // verified 10-minute Sheet sync may subsequently refresh this character.
  let updated = false;
  let changed: Member = {
    ...check.member, nickname, guild, job,
    growthPowerNumber: Number(power), growthPower: Number(power).toLocaleString("en-US"),
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const snapshot = attempt === 0 ? check.data :
      (await supabaseAdmin.from("portal_sheet_snapshots")
        .select("payload,fetched_at").eq("guild_id", check.guildId)
        .eq("source_key", "manual-guild-roster").eq("query_key", "v1")
        .maybeSingle()).data;
    if (!snapshot || !Array.isArray(snapshot.payload?.members)) break;
    const current: Member | undefined = snapshot.payload.members.find(
      (m: Member) => String(m.gid) === gid
    );
    if (!current || current.guild !== check.member.guild ||
        current.nickname !== check.member.nickname) break;
    changed = {
      ...current, nickname, guild, job,
      growthPowerNumber: Number(power), growthPower: Number(power).toLocaleString("en-US"),
    };
    const remainingOverrides = (Array.isArray(snapshot.payload.overrideGids)
      ? snapshot.payload.overrideGids : []).map(String).filter((id: string) => id !== gid);
    const newRoster = snapshot.payload.members.map((m: Member) =>
      String(m.gid) === gid ? changed : m
    );
    const now = new Date().toISOString();
    const { data: saved, error } = await supabaseAdmin.from("portal_sheet_snapshots")
      .update({
        payload: { ...snapshot.payload, members: newRoster,
          overrideGids: remainingOverrides },
        fetched_at: now, invalidated_at: null,
      })
      .eq("guild_id", check.guildId).eq("source_key", "manual-guild-roster")
      .eq("query_key", "v1").eq("fetched_at", snapshot.fetched_at)
      .select("fetched_at").maybeSingle();
    if (error) break;
    if (saved) { updated = true; break; }
  }
  if (!updated) {
    invalidatePortalSheetReads();
    return NextResponse.json({
      success: false, sheetSynced: true, portalSynced: false,
      message: "원본 Google Sheets에는 저장됐으나 밍보드 캐시 갱신에 실패했습니다. 새로고침 후 상태를 확인해주세요.",
    }, { status: 503 });
  }

  invalidatePortalSheetReads();
  const audit = await writeAuditLog({
    action: "UPDATE", targetType: "guild_member",
    targetId: gid, targetName: nickname,
    actorDiscordId: String(check.session.user.discordId || ""),
    actorName: check.session.user.name || "담당자",
    actorRole: check.session.user.isMaster ? "MASTER" : "ADMIN",
    beforeData: check.member, afterData: changed,
    description: check.access.kind === "scoped"
      ? `[${check.access.guild} 담당자] ${renamed ? check.member.nickname + " → " + nickname + " 닉네임·" : ""}성장력·직업 수정`
      : `${renamed ? check.member.nickname + " → " + nickname : nickname} 길드원 정보 수정`,
  });
  return NextResponse.json({ success: true,
    sheetSynced: true, portalSynced: true, auditSaved: audit.success,
    message: renamed
      ? `${check.member.nickname} → ${nickname} 닉네임 변경 및 길드원 정보를 원본 Google Sheets와 밍보드에 반영했습니다.`
      : `${nickname}님의 성장력과 직업을 원본 Google Sheets와 밍보드에 반영했습니다.` });
}

export async function DELETE(_request: Request, context: Context) {
  const { gid } = await context.params;
  if (!/^\\d+$/.test(gid)) return NextResponse.json({
    success: false, message: "GID 오류"
  }, { status: 400 });

  const check = await findWritable(gid);
  if ("error" in check) return NextResponse.json({
    success: false, message: check.error
  }, { status: check.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GUILD_WRITE_SECRET;
  if (!scriptUrl || !secret) return NextResponse.json({
    success: false, sheetSynced: false, portalSynced: false,
    message: "원본 Google Sheets 연동 설정이 없어 탈퇴를 처리하지 않았습니다."
  }, { status: 503 });

  // The deployed Apps Script's deleteGuildMember archives 🧾길드현황
  // to 🧾탈퇴인원 using the immutable GID and then clears the active row.
  // Never remove this member from the portal before the Sheet confirms success.
  let sheetReply: {
    success?: boolean;
    message?: string;
    member?: { gid?: string | number; status?: string; nickname?: string };
  };
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "deleteGuildMember", secret, gid
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    sheetReply = await response.json();
    if (!response.ok || !sheetReply?.success ||
        String(sheetReply.member?.gid ?? "") !== gid ||
        sheetReply.member?.status !== "탈퇴") {
      return NextResponse.json({
        success: false, sheetSynced: false, portalSynced: false,
        message: sheetReply?.message ||
          "원본 시트에서 탈퇴 처리 결과를 확인하지 못했습니다. 밍보드는 변경하지 않았습니다."
      }, { status: 502 });
    }
  } catch {
    return NextResponse.json({
      success: false, sheetSynced: false, portalSynced: false,
      message: "원본 시트 응답을 확인하지 못했습니다. 재시도하기 전 🧾길드현황과 🧾탈퇴인원을 확인해주세요."
    }, { status: 502 });
  }

  // The Sheet is now archived. Record the member's revoked access and keep
  // the portal archive, participation, and equipment history intact.
  let lifecycle: Awaited<ReturnType<typeof setMemberLifecycleStatus>>;
  try {
    lifecycle = await setMemberLifecycleStatus({
      gid, status: "left", actorDiscordId: String(check.session.user.discordId || ""),
      reason: check.access.kind === "scoped"
        ? `scoped_manager_${check.access.guild}` : "admin_member_leave",
    });
    await archiveCuratedMember(gid);
  } catch (error) {
    invalidatePortalSheetReads();
    console.error("Sheet archived but portal departure incomplete",
      error instanceof Error ? error.message : "unknown");
    return NextResponse.json({
      success: false, sheetSynced: true, portalSynced: false,
      message: "구글시트에서 탈퇴자 이동은 완료됐지만 밍보드 후속 반영에 실패했습니다. 중복 탈퇴하지 말고 전체 관리자에게 확인해주세요."
    }, { status: 503 });
  }

  invalidatePortalSheetReads();
  const audit = await writeAuditLog({
    action: "UPDATE", targetType: "guild_member_status", targetId: gid,
    targetName: check.member.nickname,
    actorDiscordId: String(check.session.user.discordId || ""),
    actorName: check.session.user.name || "담당자",
    actorRole: check.session.user.isMaster ? "MASTER" : "ADMIN",
    beforeData: check.member,
    afterData: {
      status: "left", linksRevoked: lifecycle.linksRevoked,
      sheetArchived: true, portalArchived: true,
    },
    description: `[${check.member.guild}] ${check.member.nickname} 길드원 탈퇴처리 (원본 시트·밍보드)`,
  });
  const warning = lifecycle.roleResults.some(x => !x.success)
    ? "Discord 역할 회수에 실패한 계정이 있습니다. 연동은 해제했습니다."
    : null;
  return NextResponse.json({
    success: true, sheetSynced: true, portalSynced: true,
    auditSaved: audit.success,
    message: `${check.member.nickname}님을 🧾탈퇴인원으로 옮기고 밍보드 활동 명단에서 제외했습니다.`,
    warning,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
