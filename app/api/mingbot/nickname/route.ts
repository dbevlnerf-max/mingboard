import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { invalidatePortalSheetReads } from "@/lib/sheet-read";

export const runtime = "nodejs";
const GUILDS = new Set(["핑뚝", "천제", "아스가르드", "지옥소녀"]);
type Member = { gid: string | number; nickname: string; guild: string; job: string;
 growthPower: string; [key: string]: unknown };
function respond(message: string, status: number) {
  return NextResponse.json({success:false,message}, {status});
}
function sameSecret(value: string | null) {
  const secret = process.env.MINGBOT_API_SECRET || "";
  if (!secret || !value) return false;
  const a=Buffer.from(value), b=Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a,b);
}
const normalized = (s: string) => s.normalize("NFKC").toLocaleLowerCase("ko-KR");
function validNickname(value: string) {
  return value.length >= 1 && [...value].length <= 20 && !/[\u0000-\u001f\u007f<>@\[\]]/u.test(value);
}

export async function POST(request: Request) {
  if (!sameSecret(request.headers.get("x-mingbot-secret")))
    return respond("밍봇 인증 실패",401);
  let body: Record<string, unknown>;
  try { body=await request.json(); } catch { return respond("요청 형식 오류",400); }
  const action=String(body.action||"");
  const actor=String(body.discordId||"").trim();
  const discordGuild=String(body.guildId||"");
  const guild=String(body.guild||"").trim();
  const nickname=String(body.nickname||"").trim();
  const requestedGid=String(body.gid||"").trim();
  const beforeName=String(body.beforeNickname||"").trim();
  if (!["verify_registration","verify_rename","commit_rename"].includes(action))
    return respond("지원하지 않는 명령어",400);
  if (!/^\d{15,22}$/.test(actor) || discordGuild!==process.env.DISCORD_GUILD_ID)
    return respond("운영 Discord 서버의 계정만 사용할 수 있습니다.",403);
  if (!GUILDS.has(guild) || !validNickname(nickname))
    return respond("길드 또는 닉네임 형식을 확인해주세요.",400);

  const [snapshotResult, linkResult] = await Promise.all([
    supabaseAdmin.from("portal_sheet_snapshots").select("payload,fetched_at")
      .eq("guild_id",discordGuild).eq("source_key","manual-guild-roster")
      .eq("query_key","v1").maybeSingle(),
    supabaseAdmin.from("guild_member_discord_links").select("gid,account_type")
      .eq("discord_id",actor).is("revoked_at",null),
  ]);
  const snap=snapshotResult.data;
  if (snapshotResult.error || !snap || snap.payload?.mode!=="authoritative" ||
      !Array.isArray(snap.payload.members))
    return respond("승인된 길드원 명단을 확인할 수 없습니다.",503);
  if (linkResult.error) return respond("Discord 연결정보 확인 실패",503);
  const linked=new Set((linkResult.data||[]).map(x=>String(x.gid)));
  if (!linked.size)
    return respond("밍보드에 본인 Discord 계정과 연결된 캐릭터가 없습니다. 운영진에게 본인 GID 연결을 요청해주세요.",403);
  const roster:Member[]=snap.payload.members;
  const candidates=roster.filter(m=>linked.has(String(m.gid)) && m.guild===guild);
  if (!candidates.length)
    return respond("이 Discord 계정에 연결된 해당 길드 캐릭터가 없습니다.",403);

  const stateResult=await supabaseAdmin.from("guild_member_states").select("gid,status")
    .in("gid",candidates.map(m=>Number(m.gid)));
  if (stateResult.error) return respond("현재 길드원 상태 확인 실패",503);
  const active=new Set((stateResult.data||[])
    .filter(s=>s.status==="active").map(s=>String(s.gid)));
  const eligible=candidates.filter(m=>active.has(String(m.gid)));
  if (!eligible.length) return respond("활동 중인 연결 캐릭터를 찾을 수 없습니다.",403);

  if (action==="verify_registration") {
    // An account claiming a character by name alone is NOT evidence of ownership.
    // Only the pre-approved GID–Discord binding is allowed to grant Zeus access.
    const member=eligible.find(m=>m.nickname===nickname);
    if (!member) return respond("입력한 닉네임은 이 Discord 계정에 연결된 캐릭터가 아닙니다.",403);
    return NextResponse.json({success:true,gid:String(member.gid),
      nickname:member.nickname,guild:member.guild});
  }
  if (!beforeName) return respond("기존 캐릭터 닉네임 확인이 필요합니다.",400);
  // Existing Discord nickname selects one exact GID, even if the account
  // owns several characters. Never guess the character from the new nickname.
  const member=eligible.find(m=>m.nickname===beforeName &&
    (!requestedGid || String(m.gid)===requestedGid));
  if (!member) return respond("기존 닉네임과 연결된 본인 캐릭터를 찾지 못했습니다.",403);
  const duplicate=roster.find(m=>String(m.gid)!==String(member.gid) &&
    normalized(m.nickname)===normalized(nickname));
  if (duplicate) return respond("다른 길드원이 이미 사용 중인 닉네임입니다.",409);
  if (nickname===beforeName) return respond("현재 닉네임과 동일합니다.",409);
  if (action==="verify_rename")
    return NextResponse.json({success:true,gid:String(member.gid),
      beforeNickname:member.nickname,nickname,guild});

  // Re-read current nickname and linked account immediately before any write
  // (the check above is per request); never change GID or guild.
  const scriptUrl=process.env.GOOGLE_SCRIPT_URL;
  const secret=process.env.GUILD_WRITE_SECRET;
  if (!scriptUrl||!secret) return respond("원본 Google Sheets 저장 설정이 없습니다.",503);
  let sheetData:{success?:boolean;message?:string;member?:{gid?:string|number}};
  try {
    const response=await fetch(scriptUrl,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"updateGuildMember",secret,
        gid:String(member.gid),nickname,job:member.job,
        growthPower:String(member.growthPower).replace(/,/g,""),guild}),
      cache:"no-store",signal:AbortSignal.timeout(15000),
    });
    sheetData=await response.json();
    if (!response.ok||!sheetData?.success||
        (sheetData.member?.gid&&String(sheetData.member.gid)!==String(member.gid)))
      return respond(sheetData?.message||"Google Sheets에 닉네임을 저장하지 못했습니다.",502);
  } catch {
    return respond("Google Sheets 연결 실패. 저장 여부를 운영진에게 확인해주세요.",502);
  }

  let persisted=false;
  for (let attempt=0;attempt<3;attempt++) {
    const currentSnap=attempt===0 ? snap :
      (await supabaseAdmin.from("portal_sheet_snapshots").select("payload,fetched_at")
        .eq("guild_id",discordGuild).eq("source_key","manual-guild-roster")
        .eq("query_key","v1").maybeSingle()).data;
    if (!currentSnap || !Array.isArray(currentSnap.payload?.members)) break;
    const list:Member[]=currentSnap.payload.members;
    const current=list.find(m=>String(m.gid)===String(member.gid));
    if (!current || current.nickname!==beforeName || current.guild!==guild ||
        list.some(m=>String(m.gid)!==String(member.gid) &&
          normalized(m.nickname)===normalized(nickname))) break;
    const now=new Date().toISOString();
    const overrides=Array.isArray(currentSnap.payload.overrideGids)
      ? currentSnap.payload.overrideGids.map(String).filter((g:string)=>g!==String(member.gid)) : [];
    const nextList=list.map(m=>String(m.gid)===String(member.gid)?{...m,nickname}:m);
    const {data,error}=await supabaseAdmin.from("portal_sheet_snapshots")
      .update({payload:{...currentSnap.payload,members:nextList,overrideGids:overrides},
        fetched_at:now,invalidated_at:null})
      .eq("guild_id",discordGuild).eq("source_key","manual-guild-roster")
      .eq("query_key","v1").eq("fetched_at",currentSnap.fetched_at)
      .select("fetched_at").maybeSingle();
    if(error)break;
    if(data){persisted=true;break;}
  }
  if(!persisted){
    invalidatePortalSheetReads();
    return NextResponse.json({success:false,sheetSynced:true,portalSynced:false,
      message:"Google Sheets에는 저장됐으나 밍보드 동기화에 실패했습니다. 운영진 확인이 필요합니다."},{status:503});
  }
  invalidatePortalSheetReads();
  const audit=await supabaseAdmin.from("audit_logs").insert({
    action:"UPDATE",target_type:"guild_member_nickname",target_id:String(member.gid),
    target_name:nickname,actor_discord_id:actor,actor_name:actor,
    actor_role:"MEMBER",before_data:{gid:member.gid,nickname:beforeName,guild},
    after_data:{gid:member.gid,nickname,guild},
    description:"[밍봇 본인 계정] "+beforeName+" → "+nickname,
  }).select("id").maybeSingle();
  if(audit.error) console.error("[밍봇 닉네임 변경 감사로그 저장 실패]",audit.error.code);
  return NextResponse.json({success:true,sheetSynced:true,portalSynced:true,
    auditSaved:!audit.error,gid:String(member.gid),beforeNickname:beforeName,
    nickname,guild,message:"닉네임이 원본 시트 및 밍보드에 반영됐습니다."});
}
