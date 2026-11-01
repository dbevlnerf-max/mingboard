import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { invalidatePortalSheetReads } from "@/lib/sheet-read";
import { findHistoricalNicknameConflict, reservedNicknameMessage } from "@/lib/guild-nickname-reservation";

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

/**
 * User-approved one-time recovery for Discord username jeongsix_:
 * the existing character 오피조건녀 (GID 331, 아스가르드).
 * The real username is fetched from Discord with our bot token, NEVER
 * trusted from the caller's JSON. This exception expires automatically.
 * It cannot target any other character or any other Discord username.
 */
async function verifiedJeongsixRecovery(
  actor: string, discordGuild: string, targetGid: string
): Promise<string | null> {
  if (targetGid !== "331" || Date.now() >= Date.parse("2026-11-15T14:59:59Z"))
    return null;
  const token=process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord verification token is missing");
  const r=await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(discordGuild)}/members/${encodeURIComponent(actor)}`,
    {headers:{Authorization:`Bot ${token}`},cache:"no-store",signal:AbortSignal.timeout(7000)}
  );
  if (!r.ok) throw new Error("Discord account lookup failed: " + r.status);
  const member: {user?:{id?:string;username?:string}}=await r.json();
  const name=String(member.user?.username||"");
  if (String(member.user?.id||"")!==actor ||
      name.normalize("NFKC").toLowerCase()!=="jeongsix_") return null;
  return name;
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
    // Only GID331/아스가르드 is authorized, for the Discord-verified jeongsix_ account.
    let approvedUsername:string|null=null;
    if (String(target.gid)==="331" && guild==="아스가르드") {
      try {
        approvedUsername=await verifiedJeongsixRecovery(actor,discordGuild,String(target.gid));
      } catch (error) {
        console.error("[jeongsix_ 복구 인증 실패]",error instanceof Error?error.message:"unknown");
        return respond("Discord 본인 계정을 확인하지 못했습니다. 잠시 후 다시 등록해주세요.",503);
      }
    }
    if (!approvedUsername && linked.size && !linked.has(String(target.gid)))
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
    if(!approvedUsername && previous.some(link=>link.discord_id===actor && link.revoked_at))
      return respond("이 계정의 기존 연결이 해제된 상태입니다. 운영진에게 재연결을 요청해주세요.",403);
    // SQL link RPC checks all historical rows, even those already revoked.
    // Diagnose that condition before returning a misleading generic error.
    const {data:priorAccounts,error:priorAccountError}=await supabaseAdmin
      .from("guild_member_discord_links")
      .select("gid,revoked_at,revoke_reason")
      .eq("discord_id",actor);
    if(priorAccountError) return respond("Discord 과거 연결기록 조회 실패",503);
    const stale=(priorAccounts||[]).find(link=>String(link.gid)!==String(target.gid));
    if(stale && !approvedUsername) return respond(
      stale.revoked_at
        ? "이 Discord 계정은 이전 캐릭터(GID "+stale.gid+")에서 연결 해제된 이력이 있습니다. 자동 재연결은 제한됩니다. 운영진에게 계정 이전을 요청해주세요."
        : "이 Discord 계정은 다른 캐릭터(GID "+stale.gid+")에 연결되어 있습니다. 운영진에게 계정 이전을 요청해주세요.",
      409
    );
    if(action==="verify_registration")
      return NextResponse.json({success:true,gid:String(target.gid),
        nickname:target.nickname,guild:target.guild,
        registrationMode:approvedUsername?"approved-relink":previous.length?"existing":"first"});
    if(approvedUsername) {
      // One explicit recovery, tied to a verified Discord user ID. Keep
      // character GIDs, nicknames, power and historical distribution untouched.
      const {data:earlier,error:lookupError}=await supabaseAdmin
        .from("guild_member_discord_links")
        .select("id,gid,revoked_at,account_type")
        .eq("discord_id",actor).maybeSingle();
      if(lookupError) return respond("이전 Discord 연결을 조회하지 못했습니다.",503);
      if (earlier) {
        const oldGid=String(earlier.gid);
        const {data:moved,error:moveError}=await supabaseAdmin
          .from("guild_member_discord_links")
          .update({
            gid:Number(target.gid),account_type:"primary",
            discord_username:approvedUsername,
            discord_display_name:nickname+"["+guild+"]",
            revoked_at:null,revoke_reason:null
          })
          .eq("id",earlier.id).eq("gid",Number(oldGid))
          .eq("discord_id",actor).select("id,gid").maybeSingle();
        if(moveError || !moved || String(moved.gid)!==String(target.gid)) {
          console.error("[오피조건녀 승인 재등록 실패]",moveError?.code||"conflict");
          return respond("승인된 계정 연결 이전에 실패했습니다. 운영진에게 확인해주세요.",409);
        }
        if (oldGid!==String(target.gid) && earlier.account_type==="primary") {
          const {data:subs}=await supabaseAdmin
            .from("guild_member_discord_links")
            .select("id").eq("gid",Number(oldGid))
            .is("revoked_at",null).in("account_type",["sub","discord_alt"])
            .order("created_at",{ascending:true}).limit(1);
          if(subs?.[0]) {
            const {error:promoteError}=await supabaseAdmin
              .from("guild_member_discord_links")
              .update({account_type:"primary"}).eq("id",subs[0].id);
            if(promoteError)console.error("[기존 GID 부계정 승격 확인 필요]",promoteError.code);
          }
        }
        const {error:transferAuditError}=await supabaseAdmin.from("audit_logs").insert({
          action:"UPDATE",target_type:"guild_member_discord_link",
          target_id:String(target.gid),target_name:nickname,
          actor_discord_id:actor,actor_name:approvedUsername,actor_role:"MEMBER",
          before_data:{gid:oldGid,discordId:actor},
          after_data:{gid:String(target.gid),nickname,discordId:actor},
          description:"승인된 Discord 계정 재등록: 이전 GID "+oldGid+" → 오피조건녀 GID 331"
        });
        if(transferAuditError)console.error("[승인 재등록 감사로그 실패]",transferAuditError.code);
      } else {
        const {error:initialError}=await supabaseAdmin.rpc("link_guild_member_discord_account",{
          p_gid:Number(target.gid),p_discord_id:actor,
          p_discord_username:approvedUsername,
          p_discord_display_name:nickname+"["+guild+"]",p_account_type:"primary"
        });
        if(initialError) {
          console.error("[승인 최초 연결 실패]",initialError.code);
          return respond("승인된 최초 계정 연결에 실패했습니다. 운영진에게 확인해주세요.",409);
        }
      }
    } else if(!previous.length){
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
        if (claimError.code==="P0001") {
          const errorMessage=String(claimError.message||"");
          if (errorMessage.includes("다른 길드원에게 연결"))
            return respond("이 Discord 계정의 과거 또는 현재 연결이 다른 GID에 남아 있습니다. 기존 연결 확인과 운영진 승인이 필요합니다.",409);
          if (errorMessage.includes("2개가 연결"))
            return respond("이 캐릭터의 Discord 연결 가능한 2개 계정이 이미 모두 등록돼 있습니다.",409);
          if (errorMessage.includes("소유권 이전"))
            return respond("캐릭터 소유권 이전 보호가 설정되어 운영진 승인이 필요합니다.",409);
        }
        return respond("최초 계정 연결 저장이 실패했습니다. 운영진에게 Discord 숫자 ID와 오류 발생 시각을 알려주세요.",409);
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
  // Also reject names from former characters, departed members, and old
  // distribution ledger recipients BEFORE any Google Sheet write.
  try {
    const conflict=await findHistoricalNicknameConflict(nickname, member.gid);
    if (conflict) return respond(reservedNicknameMessage,409);
  } catch {
    return respond("닉네임 사용이력을 확인할 수 없어 변경을 중단했습니다.",503);
  }
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
  const keys=[...new Set((data||[]).map(row => String(row.before_data?.nickname||"").trim())
    .filter(Boolean).map(normalized))];
  const historicalNames=keys.length
    ? await supabaseAdmin.from("guild_nickname_registry")
      .select("name_key,owner_gid").in("name_key",keys)
    : {data:[] as {name_key:string;owner_gid:number|null}[],error:null};
  if(historicalNames.error) return respond("분배 이름의 과거 소유권을 확인하지 못했습니다.",503);
  const reservationOwner=new Map((historicalNames.data||[]).map(x=>[
    String(x.name_key),x.owner_gid==null?null:String(x.owner_gid)
  ]));
  const events=(data||[]).flatMap(row=>{
    const prior=String(row.before_data?.nickname||"").trim();
    const next=String(row.after_data?.nickname||"").trim();
    if (!prior || !next || prior===next) return [];
    const key=normalized(prior);
    const ambiguous=(
      (reservationOwner.has(key) &&
        reservationOwner.get(key)!==String(row.target_id)) ||
      knownMembers.some(m =>
        String(m.gid)!==String(row.target_id) &&
        normalized(String(m.nickname||""))===key
      )
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
