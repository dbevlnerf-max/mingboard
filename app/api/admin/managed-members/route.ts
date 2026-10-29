import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberAccess, MANAGED_GUILDS } from "@/lib/guild-scoped-admin";

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
