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
  if (check.access.kind === "scoped" &&
    (String(body.nickname ?? check.member.nickname).trim() !== check.member.nickname ||
     String(body.guild ?? check.member.guild).trim() !== check.member.guild))
    return NextResponse.json({ success: false, message: "길드 담당자는 닉네임 및 소속 길드를 변경할 수 없습니다." }, { status: 403 });

  const nickname = check.access.kind === "full"
    ? String(body.nickname ?? check.member.nickname).trim() : check.member.nickname;
  const guild = check.access.kind === "full"
    ? String(body.guild ?? check.member.guild).trim() : check.member.guild;
  if (!nickname || !["핑뚝","천제","아스가르드","지옥소녀"].includes(guild))
    return NextResponse.json({ success: false, message: "닉네임 또는 소속 길드가 올바르지 않습니다." }, { status: 400 });

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
      return NextResponse.json({
        success: false, sheetSynced: false,
        message: sheetResult?.message || "원본 Google Sheets 저장에 실패했습니다. 변경 사항은 반영하지 않았습니다.",
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
      ? `[${check.access.guild} 담당자] ${nickname} 성장력·직업 수정`
      : `${nickname} 길드원 정보 수정`,
  });
  return NextResponse.json({ success: true,
    sheetSynced: true, portalSynced: true, auditSaved: audit.success,
    message: `${nickname}님의 성장력과 직업을 원본 Google Sheets와 밍보드에 반영했습니다.` });
}

export async function DELETE(_request: Request, context: Context) {
  const { gid } = await context.params;
  if (!/^\d+$/.test(gid)) return NextResponse.json({ success: false, message: "GID 오류" }, { status: 400 });
  const check = await findWritable(gid);
  if ("error" in check) return NextResponse.json({ success: false, message: check.error }, { status: check.status });

  // Status is revoked before the archival removal. Keep the original records.
  try {
    const lifecycle = await setMemberLifecycleStatus({
      gid, status: "left", actorDiscordId: String(check.session.user.discordId || ""),
      reason: check.access.kind === "scoped" ? `scoped_manager_${check.access.guild}` : "admin_member_leave",
    });
    await archiveCuratedMember(gid);
    invalidatePortalSheetReads();
    const audit = await writeAuditLog({
      action: "UPDATE", targetType: "guild_member_status", targetId: gid,
      targetName: check.member.nickname,
      actorDiscordId: String(check.session.user.discordId || ""),
      actorName: check.session.user.name || "담당자",
      actorRole: check.session.user.isMaster ? "MASTER" : "ADMIN",
      beforeData: check.member,
      afterData: { status: "left", linksRevoked: lifecycle.linksRevoked },
      description: `[${check.member.guild}] ${check.member.nickname} 길드원 탈퇴처리`,
    });
    return NextResponse.json({ success: true, auditSaved: audit.success,
      message: `${check.member.nickname}님을 탈퇴 처리했습니다.`,
      warning: lifecycle.roleResults.some(x => !x.success)
        ? "Discord 역할 회수에 실패한 계정이 있습니다. 연결은 해제했습니다." : null });
  } catch (error) {
    return NextResponse.json({ success: false,
      message: error instanceof Error ? error.message : "탈퇴 처리 실패. 운영자에게 확인해주세요." },
      { status: 500 });
  }
}
