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
  if (!["verify_registration","commit_registration","verify_rename","commit_rename"].includes(action))
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
  const roster: Member[] = snap.payload.members;
  const linked=new Set((linkResult.data||[]).map(x=>String(x.gid)));

  // First-time registration is a DIFFERENT trust flow from later self-renames.
  // A new user naturally has no Discord ID <-> GID link yet. Validate against
  // the authoritative roster and prevent claiming already linked characters.
  if(action==="verify_registration" || action==="commit_registration") {
    const target=roster.find(m=>m.guild===guild && m.nickname===nickname &&
      (!requestedGid || requestedGid===String(m.gid)));
    if(!target) return respond("해당 길드의 등록된 캐릭터 닉네임을 찾지 못했습니다.",404);
    if (linked.size && !linked.has(String(target.gid)))
      return respond("이 Discord 계정은 이미 다른 캐릭터와 연결돼 있습니다. 운영진에게 확인해주세요.",403);
    const [claimedResult, memberState] = await Promise.all([
      supabaseAdmin.from("guild_member_discord_links")
        .select("discord_id,revoked_at").eq("gid",Number(target.gid)),
      supabaseAdmin.from("guild_member_states")
        .select("status").eq("gid",Number(target.gid)).maybeSingle(),
    ]);
    if(claimedResult.error || memberState.error)
      return respond("길드원 소유권 확인 중 오류가 발생했습니다.",503);
    if(memberState.data?.status!=="active")
      return respond("현재 활동 중인 길드원만 최초 인증할 수 있습니다.",403);
    const previous=claimedResult.data||[];
    if(previous.some(link=>link.discord_id!==actor))
      return respond("이 캐릭터는 이미 다른 Discord 계정에 연결된 기록이 있습니다. 운영진에게 확인해주세요.",409);
    if(previous.some(link=>link.discord_id===actor && link.revoked_at))
      return respond("이 계정의 기존 연결이 해제된 상태입니다. 운영진에게 재연결을 요청해주세요.",403);
    if(action==="verify_registration")
      return NextResponse.json({success:true,gid:String(target.gid),
        nickname:target.nickname,guild:target.guild,
        registrationMode:previous.length?"existing":"first"});
    if(!previous.length){
      const {error:claimError}=await supabaseAdmin.rpc(
        "link_guild_member_discord_account", {
          p_gid:Number(target.gid),
          p_discord_id:actor,
          p_discord_username:String(body.discordUsername||"").slice(0,100),
          p_discord_display_name:nickname+"["+guild+"]",
          p_account_type:"primary",
        }
      );
      if(claimError){
        console.error("[밍봇 최초 사용자등록 GID 연결 실패]",claimError.code);
        return respond("최초 계정 연결이 완료되지 않았습니다. 이미 등록됐는지 확인해주세요.",409);
      }
    }
    const original=beforeName.slice(0,50)||actor;
    const formatted=nickname+"["+guild+"]";
    const audit=await supabaseAdmin.from("audit_logs").insert({
      action:"UPDATE",target_type:"discord_registration",target_id:String(target.gid),
      target_name:formatted,actor_discord_id:actor,actor_name:actor,
      actor_role:"MEMBER",before_data:{gid:target.gid,nickname:original,guild},
      after_data:{gid:target.gid,nickname:formatted,guild},
      description:"[밍봇 최초 인증] "+original+" → "+formatted,
    }).select("id").maybeSingle();
    if(audit.error)console.error("[밍봇 최초등록 감사로그 실패]",audit.error.code);
    return NextResponse.json({success:true,gid:String(target.gid),
      auditSaved:!audit.error,auditId:audit.data?.id||null});
  }

  // A rename is intentionally strict: linked Discord account, active GID,
  // matching current server nickname and owner-only existing character.
  if(!linked.size)
    return respond("Discord 계정에 연결된 캐릭터가 없습니다. 먼저 사용자등록을 완료해주세요.",403);
  const candidates=roster.filter(m=>linked.has(String(m.gid)) && m.guild===guild);
  if(!candidates.length)
    return respond("이 Discord 계정에 연결된 해당 길드 캐릭터가 없습니다.",403);
  const stateResult=await supabaseAdmin.from("guild_member_states").select("gid,status")
    .in("gid",candidates.map(m=>Number(m.gid)));
  if(stateResult.error) return respond("현재 길드원 상태 확인 실패",503);
  const active=new Set((stateResult.data||[])
    .filter(row=>row.status==="active").map(row=>String(row.gid)));
  const eligible=candidates.filter(m=>active.has(String(m.gid)));
  if(!eligible.length)
    return respond("활동 중인 연결 캐릭터를 찾을 수 없습니다.",403);
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
        (sheetData.member?.gid&&String(sheetData.member.gid)!==String(member.gid))) {
      const legacy = /핑뚝.{0,20}빨뚝.{0,20}검뚝/.test(String(sheetData?.message||""));
      return respond(legacy
        ? "구글시트 Apps Script가 핑뚝·빨뚝·검뚝만 허용하는 구버전입니다. 관리자가 isValidGuild를 4개 길드로 수정하고 웹앱을 재배포해야 합니다."
        : sheetData?.message||"Google Sheets에 닉네임을 저장하지 못했습니다.",502);
    }
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


/**
 * Service-account Sheet journal consumer. The Mingbot process polls changes
 * to the existing audit_logs table and writes each nickname change exactly
 * once into the private 📝닉네임변경이력 tab (cursor stored in the bot DB).
 * This covers web guild-manager updates AND Discord self-service updates.
 */
export async function GET(request: Request) {
  if (!sameSecret(request.headers.get("x-mingbot-secret")))
    return respond("밍봇 인증 실패", 401);
  const url=new URL(request.url);
  const after=Number(url.searchParams.get("after")||"0");
  if (!Number.isSafeInteger(after)||after<0) return respond("커서 오류",400);
  const {data,error}=await supabaseAdmin.from("audit_logs")
    .select("id,created_at,target_type,target_id,actor_discord_id,actor_name,actor_role,before_data,after_data")
    .eq("action","UPDATE")
    .in("target_type",["guild_member","guild_member_nickname","discord_registration"])
    .gt("id",after).order("id",{ascending:true}).limit(150);
  if(error) return respond("닉네임 감사로그를 조회할 수 없습니다.",503);
  // Distribution ledger stores recipient name in F only, no GID.
  // Never bulk-rewrite a historic recipient if that old nickname currently
  // belongs to a different GID (including a departed character).
  const [activeResult, departedResult] = await Promise.all([
    supabaseAdmin.from("portal_sheet_snapshots").select("payload")
      .eq("guild_id",process.env.DISCORD_GUILD_ID||"")
      .eq("source_key","manual-guild-roster").eq("query_key","v1").maybeSingle(),
    supabaseAdmin.from("portal_sheet_snapshots").select("payload")
      .eq("guild_id",process.env.DISCORD_GUILD_ID||"")
      .eq("source_key","manual-guild-departed").eq("query_key","v1").maybeSingle(),
  ]);
  if(activeResult.error || departedResult.error)
    return respond("과거 분배 대상의 소유권을 확인하지 못했습니다.",503);
  const knownMembers=[...(activeResult.data?.payload?.members||[]),
    ...(departedResult.data?.payload?.members||[])].filter(
      (m:unknown):m is {nickname:string;gid:string|number} =>
        !!m && typeof m==="object" && "gid" in m && "nickname" in m
    );
  const events=(data||[]).flatMap(row=>{
    const prior=String(row.before_data?.nickname||"").trim();
    const next=String(row.after_data?.nickname||"").trim();
    if (!prior || !next || prior===next) return [];
    const ambiguous=knownMembers.some(m =>
      String(m.gid)!==String(row.target_id) &&
      normalized(String(m.nickname||""))===normalized(prior)
    );
    return [{
      id:row.id,occurredAt:row.created_at,gid:row.target_id,
      distributionRenameSafe: !ambiguous,
      distributionRenameReason: ambiguous
        ? "이전 닉네임을 다른 GID가 사용 중이거나 사용한 기록이 있어 F열 변경을 보류합니다."
        : "",
      guild:String(row.after_data?.guild||row.before_data?.guild||""),
      oldNickname:prior,newNickname:next,
      actorDiscordId:row.actor_discord_id,actorName:row.actor_name,
      actorRole:row.actor_role,
      source:row.target_type==="discord_registration"?"최초 인증":
        row.target_type==="guild_member_nickname"?"밍봇 셀프변경":"밍보드 관리자",
    }];
  });
  return NextResponse.json({success:true,events,
    nextCursor:(data||[]).length?Number(data![data!.length-1].id):after,
    hasMore:(data||[]).length===150},{
    headers:{"Cache-Control":"private, no-store"},
  });
}
