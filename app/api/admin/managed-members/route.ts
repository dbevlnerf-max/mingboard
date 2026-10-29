import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberAccess, MANAGED_GUILDS } from "@/lib/guild-scoped-admin";
import { invalidatePortalSheetReads } from "@/lib/sheet-read";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  const access = await getMemberAccess(session?.user);
  if (access.kind === "denied") return NextResponse.json(
    { success: false, message: "길드원 관리 권한이 없습니다." }, { status: 403 }
  );
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return NextResponse.json({ success: false, message: "길드 설정이 없습니다." }, { status: 500 });
  const { data, error } = await supabaseAdmin.from("portal_sheet_snapshots")
    .select("payload,fetched_at").eq("guild_id", guildId)
    .eq("source_key", "manual-guild-roster").eq("query_key", "v1").maybeSingle();
  if (error || !data || data.payload?.mode !== "authoritative" || !Array.isArray(data.payload.members)) {
    return NextResponse.json({ success: false, message: "승인된 길드원 명단을 불러오지 못했습니다." }, { status: 503 });
  }
  // Critical: filter server-side, not only in the browser.
  const active = data.payload.members.filter((m: { guild?: string; gid?: string }) =>
    m && MANAGED_GUILDS.some(g => g === m.guild) &&
    (access.kind === "full" || m.guild === access.guild)
  );
  const jobs = [...new Set(active.map((m: { job?: string }) => String(m.job || "")).filter(Boolean))].sort();
  const counts = Object.fromEntries(["전체", ...MANAGED_GUILDS].map(g =>
    [g, g === "전체" ? active.length : active.filter((m: { guild?: string }) => m.guild === g).length]
  ));
  return NextResponse.json({
    success: true, members: active, jobs, counts, scope: access.kind === "full" ? null : access.guild,
    updatedAt: data.fetched_at,
  }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}


/**
 * A scoped operator may create members ONLY within their assigned guild.
 * Google Sheet is written first. The new GID must come from Apps Script,
 * never from a client or a locally guessed sequence number.
 * The portal snapshot is updated immediately on successful Sheet write.
 */
export async function POST(request: Request) {
  const session = await auth();
  const access = await getMemberAccess(session?.user);
  if (access.kind === "denied") return NextResponse.json({
    success: false, message: "길드원 추가 권한이 없습니다."
  }, { status: 403 });

  const guildId = process.env.DISCORD_GUILD_ID;
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GUILD_WRITE_SECRET;
  if (!guildId || !scriptUrl || !secret) return NextResponse.json({
    success: false, message: "원본 구글시트 연동 설정을 확인할 수 없습니다."
  }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const nickname = String(body.nickname ?? "").trim();
  const job = String(body.job ?? "").trim();
  const power = String(body.growthPower ?? "").replace(/,/g, "").trim();
  const guild = String(body.guild ?? "").trim();
  if (!nickname || [...nickname].length > 24 ||
      /[\u0000-\u001f\u007f]/u.test(nickname) || !job || job.length > 40 ||
      !/^\d{1,9}$/.test(power) || Number(power) < 1 ||
      !MANAGED_GUILDS.includes(guild as typeof MANAGED_GUILDS[number])) {
    return NextResponse.json({
      success: false, message: "닉네임(1~24자), 직업, 전투력, 길드를 확인해주세요."
    }, { status: 400 });
  }
  if (access.kind === "scoped" && guild !== access.guild)
    return NextResponse.json({
      success: false, message: "다른 길드에 인원을 추가할 수 없습니다."
    }, { status: 403 });

  const readSnapshot = async () => supabaseAdmin.from("portal_sheet_snapshots")
    .select("payload,fetched_at").eq("guild_id", guildId)
    .eq("source_key", "manual-guild-roster").eq("query_key", "v1").maybeSingle();
  const initial = await readSnapshot();
  if (initial.error || initial.data?.payload?.mode !== "authoritative" ||
      !Array.isArray(initial.data?.payload?.members))
    return NextResponse.json({
      success: false, message: "승인된 길드원 명단을 불러오지 못했습니다."
    }, { status: 503 });

  const normalize = (s: string) => s.trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
  const nameKey = normalize(nickname);
  if (initial.data.payload.members.some((m: {nickname:string}) => normalize(String(m.nickname || "")) === nameKey))
    return NextResponse.json({
      success: false, message: "이미 등록된 닉네임입니다."
    }, { status: 409 });

  let sheet: {
    success?: boolean; message?: string;
    member?: {gid?:string | number; guild?:string; nickname?:string; no?:string | number};
  };
  try {
    const response = await fetch(scriptUrl, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        action: "addGuildMember", secret, nickname, job,
        growthPower: power, guild
      }),
      cache:"no-store", signal:AbortSignal.timeout(15000),
    });
    sheet = await response.json();
    if (!response.ok || !sheet?.success)
      return NextResponse.json({
        success:false, sheetSynced:false,
        message:sheet?.message || "원본 구글시트에 길드원을 추가하지 못했습니다."
      }, { status:502 });
  } catch {
    return NextResponse.json({
      success:false,sheetSynced:false,
      message:"Google Sheets 연결에 실패했습니다. 실제 저장 여부를 확인한 뒤 다시 시도해주세요."
    },{status:502});
  }

  const gid = String(sheet.member?.gid ?? "").trim();
  if (!/^\d+$/.test(gid) || Number(gid) < 1 ||
      (sheet.member?.guild && sheet.member.guild !== guild) ||
      (sheet.member?.nickname && sheet.member.nickname !== nickname)) {
    return NextResponse.json({
      success:false,sheetSynced:true,portalSynced:false,
      message:"구글시트에는 기록됐으나 발급된 GID 또는 길드 정보가 올바르지 않습니다. 운영진에게 확인해주세요."
    },{status:502});
  }

  const {data: lifecycle, error: lifecycleLookupError} = await supabaseAdmin
    .from("guild_member_states").select("gid,status").eq("gid",Number(gid)).maybeSingle();
  if (lifecycleLookupError || lifecycle) return NextResponse.json({
    success:false,sheetSynced:true,portalSynced:false,
    message:"원본 구글시트에서 발급한 GID가 기존 사용 이력과 충돌합니다. 운영진 확인이 필요합니다."
  },{status:409});

  const newMember = {
    gid, nickname, job, guild,
    growthPower:Number(power).toLocaleString("en-US"),
    growthPowerNumber:Number(power), no:String(sheet.member?.no ?? ""),
    attendanceRate:"0.00%", participationCount:0, targetCount:0
  };
  let synced = false;
  for (let attempt=0;attempt<3;attempt++) {
    const snapshot = attempt === 0 ? initial.data : (await readSnapshot()).data;
    if (!snapshot || !Array.isArray(snapshot.payload?.members)) break;
    if (snapshot.payload.members.some((m:{gid:string|number;nickname:string}) =>
      String(m.gid)===gid || normalize(String(m.nickname||""))===nameKey)) break;
    const members=[...snapshot.payload.members,newMember];
    const now=new Date().toISOString();
    const {data:updated,error} = await supabaseAdmin.from("portal_sheet_snapshots")
      .update({
        payload:{...snapshot.payload,members},
        fetched_at:now,invalidated_at:null
      }).eq("guild_id",guildId).eq("source_key","manual-guild-roster")
      .eq("query_key","v1").eq("fetched_at",snapshot.fetched_at)
      .select("fetched_at").maybeSingle();
    if(error) break;
    if(updated){synced=true;break;}
  }
  if(!synced){
    invalidatePortalSheetReads();
    return NextResponse.json({
      success:false,sheetSynced:true,portalSynced:false,
      message:"원본 Google Sheets에는 등록됐지만 밍보드 반영이 완료되지 않았습니다. 중복 추가하지 말고 운영진에게 확인해주세요."
    },{status:503});
  }

  const {error:statusError}=await supabaseAdmin.from("guild_member_states")
    .insert({gid:Number(gid),status:"active",updated_by:String(session?.user?.discordId || ""),
      reason:"guild_member_add"});
  if(statusError)console.error("[길드원 추가 활동상태 기록 실패]",statusError.code);
  invalidatePortalSheetReads();
  const audit = await writeAuditLog({
    action:"CREATE",targetType:"guild_member",targetId:gid,targetName:nickname,
    actorDiscordId:String(session?.user?.discordId || ""),
    actorName:session?.user?.name || "길드 운영진",
    actorRole:session?.user?.isMaster?"MASTER":access.kind==="scoped"?"GUILD_OPERATOR":"ADMIN",
    beforeData:null,afterData:newMember,
    description:`[${guild}] ${nickname} 길드원 원본 시트·밍보드 동시 추가`
  });
  return NextResponse.json({
    success:true,sheetSynced:true,portalSynced:true,
    auditSaved:audit.success,member:newMember,
    message:statusError
      ? `${nickname}님을 양쪽 명단에 추가했지만 활동 상태 기록 확인이 필요합니다.`
      : `${nickname}님을 원본 Google Sheets와 밍보드에 추가했습니다.`
  },{headers:{"Cache-Control":"private, no-store"}});
}
