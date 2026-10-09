import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { readSheet } from "@/lib/sheet-read";
import { includeUnreturnedGuilds, type RosterMember } from "@/lib/guild-roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
}
const clean = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const snowflake = (value: unknown) => /^\d{15,22}$/.test(clean(value, 30));
function secretValid(input: string) {
  const secret = process.env.MINGBOT_API_SECRET?.trim() ?? "";
  if (!secret || !input) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(input);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function discordMember(discordId: string) {
  const gid = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!gid || !token) throw new Error("DISCORD_CONFIG_UNAVAILABLE");
  const res = await fetch(`https://discord.com/api/v10/guilds/${gid}/members/${discordId}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("DISCORD_API_UNAVAILABLE");
  const member = await res.json();
  if (!Array.isArray(member.roles)) throw new Error("DISCORD_API_UNAVAILABLE");
  return member as { roles: string[]; nick?: string; user?: { username?: string } };
}
async function requireOperator(discordId: string) {
  const m = await discordMember(discordId);
  if (!m) return false;
  if (discordId === process.env.DISCORD_MASTER_USER_ID ||
    (Boolean(process.env.DISCORD_ADMIN_ROLE_ID) &&
      m.roles.includes(process.env.DISCORD_ADMIN_ROLE_ID!))) return true;
  // A Discord server administrator need not also have our custom admin role.
  const guildId = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!guildId || !botToken) return false;
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return false;
  const roles = await response.json() as Array<{ id: string; permissions: string }>;
  return Array.isArray(roles) && roles.some(role =>
    m.roles.includes(role.id) && (BigInt(role.permissions || "0") & BigInt(8)) !== BigInt(0));
}
async function guildRoster() {
  const script = process.env.GOOGLE_SCRIPT_URL;
  if (!script) throw new Error("GOOGLE_SCRIPT_URL_MISSING");
  const raw = await readSheet(script, new URLSearchParams({ action: "guild" }),
    new AbortController().signal, "members", false) as {
      success?: boolean; members?: RosterMember[];
    };
  if (!raw.success || !Array.isArray(raw.members)) throw new Error("GUILD_ROSTER_UNAVAILABLE");
  return (await includeUnreturnedGuilds(raw.members)).members;
}
async function lookupMember(gid: number) {
  const members = await guildRoster();
  return members.find(m => Number(m.gid) === gid);
}
async function ownershipStatus(gid: number, discordId: string) {
  const { data, error } = await supabaseAdmin.from("guild_account_ownership")
    .select("owner_discord_id").eq("gid", gid).maybeSingle();
  if (error) throw error;
  return { restricted: Boolean(data), allowed: !data || data.owner_discord_id === discordId };
}

export async function POST(request: NextRequest) {
  try {
    if (!secretValid(request.headers.get("x-mingbot-secret")?.trim() ?? "")) {
      return fail("밍봇 인증키를 확인해주세요.", 401);
    }
    if (Number(request.headers.get("content-length") || 0) > 4096) return fail("요청이 너무 큽니다.", 413);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("요청 형식이 올바르지 않습니다.");
    if (clean(body.guildId, 30) !== process.env.DISCORD_GUILD_ID) return fail("서버 ID가 다릅니다.", 403);
    const action = clean(body.action, 30);
    const actor = clean(body.actorDiscordId, 30);
    if (!snowflake(actor)) return fail("Discord 신청자 ID가 올바르지 않습니다.");

    if (action === "request") {
      const buyer = await discordMember(actor);
      if (!buyer) return fail("구매자가 Discord 서버에 가입되어 있어야 합니다.", 403);
      const gid = Number(body.gid);
      if (!Number.isSafeInteger(gid) || gid <= 0) return fail("올바른 GID를 입력해주세요.");
      const member = await lookupMember(gid);
      if (!member) return fail("현재 길드원 명단에 없는 GID입니다.", 404);
      const evidence = clean(body.evidenceReference, 1000);
      if (evidence.length < 8) return fail("운영진이 확인할 증빙 위치 또는 거래 확인 내용을 8자 이상 입력해주세요.");
      const { data: other } = await supabaseAdmin.from("guild_account_transfer_requests")
        .select("id").eq("guild_id", process.env.DISCORD_GUILD_ID!)
        .eq("gid", gid).eq("state", "pending").limit(1);
      if (other?.length) return fail("같은 캐릭터의 승인 대기 신청이 있습니다.", 409);
      const { count: pendingCount } = await supabaseAdmin.from("guild_account_transfer_requests")
        .select("*", { count: "exact", head: true })
        .eq("guild_id", process.env.DISCORD_GUILD_ID!).eq("buyer_discord_id", actor)
        .eq("state", "pending");
      if ((pendingCount ?? 0) >= 2) return fail("승인 대기 신청은 계정당 최대 2건입니다.", 429);
      const { data, error } = await supabaseAdmin.from("guild_account_transfer_requests").insert({
        guild_id: process.env.DISCORD_GUILD_ID!, gid,
        character_nickname: member.nickname, buyer_discord_id: actor,
        buyer_discord_name: clean(buyer.nick || buyer.user?.username || "", 90),
        evidence_reference: evidence, state: "pending",
      }).select("id,gid,character_nickname,state").single();
      if (error) return fail(error.code === "23505" ? "이미 접수된 이전 신청이 있습니다." : "신청 저장에 실패했습니다.", 409);
      return NextResponse.json({ success: true, request: data });
    }

    if (action === "can_authenticate") {
      if (!(await discordMember(actor))) return fail("서버 가입을 확인할 수 없습니다.", 403);
      const nickname = clean(body.nickname, 40);
      const guild = clean(body.guild, 40);
      const member = (await guildRoster()).find(m => m.nickname === nickname && m.guild === guild);
      if (!member) return fail("길드원 목록에서 닉네임을 찾을 수 없습니다.", 404);
      const status = await ownershipStatus(Number(member.gid), actor);
      return NextResponse.json({ success: true, ...status, gid: member.gid });
    }

    const admin = await requireOperator(actor);
    if (!admin) return fail("밍보드 운영진 역할 또는 최고관리자 권한이 필요합니다.", 403);

    if (action === "pending") {
      const { data, error } = await supabaseAdmin.from("guild_account_transfer_requests")
        .select("id,gid,character_nickname,buyer_discord_id,evidence_reference,created_at")
        .eq("guild_id", process.env.DISCORD_GUILD_ID!).eq("state", "pending")
        .order("created_at", { ascending: true }).limit(20);
      if (error) throw error;
      return NextResponse.json({ success: true, requests: data || [] });
    }

    const id = clean(body.requestId, 50);
    if (!/^[a-f0-9-]{36}$/i.test(id)) return fail("신청 ID가 올바르지 않습니다.");
    const { data: item, error: itemError } = await supabaseAdmin
      .from("guild_account_transfer_requests").select("*")
      .eq("id", id).eq("guild_id", process.env.DISCORD_GUILD_ID!).maybeSingle();
    if (itemError) throw itemError;
    if (!item) return fail("해당 신청을 찾지 못했습니다.", 404);

    if (action === "detail" || action === "reconcile") {
      const currentMember = await lookupMember(Number(item.gid)).catch(() => null);
      const oldIds = (Array.isArray(item.previous_links) ? item.previous_links : [])
        .map((row: { discord_id?: string }) => row.discord_id).filter(Boolean);
      const removeRoleFor: string[] = [];
      for (const id of oldIds) {
        const { count, error } = await supabaseAdmin.from("guild_member_discord_links")
          .select("*", { head: true, count: "exact" })
          .eq("discord_id", id).is("revoked_at", null);
        if (error) throw error;
        if (!count) removeRoleFor.push(id);
      }
      return NextResponse.json({ success: true, request: {
        id: item.id, gid: item.gid, nickname: item.character_nickname,
        buyerDiscordId: item.buyer_discord_id, state: item.state,
        evidenceReference: item.evidence_reference, verificationNote: item.verification_note,
        oldDiscordIds: oldIds, removeRoleFor, guild: currentMember?.guild ?? "",
      } });
    }

    if (action === "reject") {
      const note = clean(body.verificationNote, 500);
      if (note.length < 8) return fail("거절 사유를 8자 이상 입력해주세요.");
      const { data, error } = await supabaseAdmin.from("guild_account_transfer_requests")
        .update({ state: "rejected", decided_at: new Date().toISOString(),
          decided_by: actor, verification_note: note })
        .eq("id", id).eq("state", "pending").select("id,state").maybeSingle();
      if (error) throw error;
      if (!data) return fail("이미 처리됐거나 다른 관리자가 먼저 처리한 신청입니다.", 409);
      return NextResponse.json({ success: true, request: data });
    }

    if (action === "approve") {
      if (item.state !== "pending") return fail("이미 처리된 신청입니다.", 409);
      const verificationNote = clean(body.verificationNote, 500);
      if (verificationNote.length < 10 || body.evidenceVerified !== true) {
        return fail("운영진은 거래 증빙을 직접 확인하고, 확인 내용을 10자 이상 작성해야 합니다.");
      }
      if (item.buyer_discord_id === actor) return fail("신청자 본인은 승인할 수 없습니다.", 403);
      if (!(await discordMember(item.buyer_discord_id))) return fail("구매자가 Discord 서버에 없습니다.", 403);
      const member = await lookupMember(Number(item.gid));
      if (!member || member.nickname !== item.character_nickname) {
        return fail("캐릭터 정보가 신청 당시와 달라졌습니다. 운영진이 다시 확인해야 합니다.", 409);
      }
      const { data: state } = await supabaseAdmin.from("guild_member_states")
        .select("status").eq("gid", item.gid).maybeSingle();
      if (state?.status === "left") return fail("탈퇴 처리된 캐릭터는 이전할 수 없습니다.", 409);
      const { data, error } = await supabaseAdmin.rpc("approve_guild_account_transfer", {
        p_request_id: id, p_admin_id: actor, p_verification_note: verificationNote,
      });
      if (error) return fail(error.message.slice(0, 280), 409);
      const previousIds: string[] = data.previousDiscordIds || [];
      const removeRoleFor: string[] = [];
      const warnings: string[] = [];
      for (const discordId of previousIds) {
        const { count, error: remainingError } = await supabaseAdmin.from("guild_member_discord_links")
          .select("*", { count: "exact", head: true })
          .eq("discord_id", discordId).is("revoked_at", null);
        if (remainingError) {
          warnings.push("기존 계정의 다른 캐릭터 연결 여부를 확인하지 못했습니다. /계정이전 동기화 재실행 필요");
        } else if (count === 0) {
          removeRoleFor.push(discordId);
        }
      }
      return NextResponse.json({ success: true, request: {
        id, gid: data.gid, nickname: data.nickname, guild: member.guild,
        buyerDiscordId: data.buyerDiscordId,
        oldDiscordIds: previousIds, removeRoleFor, warnings, state: "approved",
      } });
    }
    return fail("지원하지 않는 작업입니다.");
  } catch (error) {
    console.error("Account transfer API error:", error instanceof Error ? error.message : "unknown");
    return fail("계정 이전 처리 중 서버 확인에 실패했습니다.", 503);
  }
}
