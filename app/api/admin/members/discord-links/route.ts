import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }
  if (!session.user.isAdmin && !session.user.isMaster) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "관리자 권한이 필요합니다." },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, session };
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const gidParam = request.nextUrl.searchParams.get("gid");
    let query = supabaseAdmin
      .from("guild_member_discord_links")
      .select("id, gid, discord_id, discord_username, discord_display_name, account_type, created_at, updated_at")
      .is("revoked_at", null);

    if (gidParam) {
      const gid = Number(gidParam);
      if (!Number.isSafeInteger(gid) || gid <= 0) {
        return NextResponse.json(
          { success: false, message: "올바른 GID가 아닙니다." },
          { status: 400 }
        );
      }
      query = query.eq("gid", gid);
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];

    if (gidParam) {
      return NextResponse.json({
        success: true,
        gid: String(gidParam),
        count: rows.length,
        max: 2,
        full: rows.length >= 2,
        links: rows.map(row => ({
          id: row.id,
          gid: String(row.gid),
          discordId: row.discord_id,
          discordUsername: row.discord_username,
          discordDisplayName: row.discord_display_name,
          accountType: row.account_type,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    }

    const counts = new Map<string, { count: number; primaryCount: number; additionalCount: number }>();
    for (const row of rows) {
      const gid = stringValue(row.gid);
      const current = counts.get(gid) || { count: 0, primaryCount: 0, additionalCount: 0 };
      current.count += 1;
      if (row.account_type === "primary") current.primaryCount += 1;
      else current.additionalCount += 1;
      counts.set(gid, current);
    }

    return NextResponse.json({
      success: true,
      counts: Array.from(counts.entries()).map(([gid, count]) => ({
        gid,
        count: count.count,
        max: 2,
        primaryCount: count.primaryCount,
        additionalCount: count.additionalCount,
        full: count.count >= 2,
      })),
    });
  } catch (error) {
    console.error("[Discord 연결관리 조회 오류]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Discord 연결정보를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdmin();
  if (!access.ok) return access.response;

  try {
    const body = await request.json().catch(() => ({}));
    const discordId = stringValue(body.discordId);
    if (!discordId) {
      return NextResponse.json(
        { success: false, message: "Discord ID가 없습니다." },
        { status: 400 }
      );
    }

    const { data: existingLink, error: findError } = await supabaseAdmin
      .from("guild_member_discord_links")
      .select("id, gid, discord_id, discord_username, discord_display_name, account_type")
      .eq("discord_id", discordId)
      .is("revoked_at", null)
      .maybeSingle();
    if (findError) throw findError;
    if (!existingLink) {
      return NextResponse.json(
        { success: false, message: "활성 연결된 Discord 계정을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString();
    const { error: unlinkError } = await supabaseAdmin
      .from("guild_member_discord_links")
      .update({
        revoked_at: timestamp,
        revoke_reason: "admin_unlink",
        updated_at: timestamp,
      })
      .eq("id", existingLink.id);
    if (unlinkError) throw unlinkError;

    await supabaseAdmin.from("member_access_history").insert({
      gid: Number(existingLink.gid),
      discord_id: discordId,
      action: "admin_unlink",
      detail: null,
    });

    return NextResponse.json({
      success: true,
      message: "Discord 계정 연결을 해제했습니다.",
      removed: {
        gid: String(existingLink.gid),
        discordId: existingLink.discord_id,
        discordUsername: existingLink.discord_username,
        discordDisplayName: existingLink.discord_display_name,
        accountType: existingLink.account_type,
      },
    });
  } catch (error) {
    console.error("[Discord 연결 해제 오류]", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Discord 계정 연결 해제에 실패했습니다." },
      { status: 500 }
    );
  }
}
