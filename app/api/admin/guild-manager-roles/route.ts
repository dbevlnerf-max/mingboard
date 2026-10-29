import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Role = { id: string; name: string; permissions: string };
const GUILDS = ["천제", "지옥소녀", "아스가르드"] as const;

export async function POST() {
  const session = await auth();
  if (!session?.user?.isGuildMember || !session.user.hasZeusRole ||
      !session.user.isMaster || session.user.authVerificationPending)
    return NextResponse.json({ success: false, message: "MASTER만 Discord 담당자 역할을 설정할 수 있습니다." }, { status: 403 });
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!token || !guildId) return NextResponse.json({ success: false, message: "Discord 설정이 없습니다." }, { status: 500 });

  const requestDiscord = async (path: string, method: string, body?: object) => {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      method, headers: { Authorization: `Bot ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Discord ${method} 오류 (HTTP ${response.status})`);
    return response.status === 204 ? null : response.json();
  };

  try {
    const { data: configs, error: configError } = await supabaseAdmin
      .from("guild_scoped_admin_roles").select("guild,role_name,role_id");
    if (configError) throw configError;
    const discordRoles = (await requestDiscord(`/guilds/${guildId}/roles`, "GET")) as Role[];
    const results: Array<{ guild: string; role: string; roleId?: string;
      assigned: string[]; pending: string[]; errors: string[] }> = [];
    for (const guild of GUILDS) {
      const config = configs?.find(item => item.guild === guild);
      if (!config) throw new Error(`${guild} 담당자 역할 설정이 없습니다.`);
      const output = { guild, role: String(config.role_name), roleId: undefined as string | undefined,
        assigned: [] as string[], pending: [] as string[], errors: [] as string[] };
      results.push(output);
      try {
        let role = discordRoles.find(item => item.id === config.role_id) ||
          discordRoles.find(item => item.name === config.role_name);
        if (!role) {
          role = await requestDiscord(`/guilds/${guildId}/roles`, "POST", {
            name: config.role_name, permissions: "0", hoist: false, mentionable: false,
          }) as Role;
          discordRoles.push(role);
        }
        // Do not use a Discord role that would confer server-wide permissions.
        if (BigInt(role.permissions || "0") !== BigInt(0)) {
          output.errors.push("기존 동일 역할에 Discord 권한이 설정되어 있습니다. 서버에서 먼저 권한을 제거해주세요.");
          continue;
        }
        output.roleId = role.id;
        const { error } = await supabaseAdmin.from("guild_scoped_admin_roles")
          .update({ role_id: role.id, updated_at: new Date().toISOString() })
          .eq("guild", guild);
        if (error) throw error;

        const { data: assignees, error: assignmentError } = await supabaseAdmin
          .from("guild_scoped_admin_assignments")
          .select("nickname,gid,discord_id").eq("guild", guild);
        if (assignmentError) throw assignmentError;
        for (const assignee of assignees || []) {
          let discordId: string | null = assignee.discord_id || null;
          if (!discordId) {
            // Allow a previously unlinked manager (e.g. 왕알) to join later.
            // Never guess a Discord account based only on a nickname.
            const { data: links, error: lookupError } = await supabaseAdmin
              .from("guild_member_discord_links").select("discord_id,account_type")
              .eq("gid", assignee.gid).is("revoked_at", null);
            if (!lookupError && links?.length) {
              const primary = links.filter(link => link.account_type === "primary");
              const chosen = primary.length === 1 ? primary[0] :
                links.length === 1 ? links[0] : null;
              if (chosen) {
                discordId = String(chosen.discord_id);
                const { error: saveError } = await supabaseAdmin
                  .from("guild_scoped_admin_assignments")
                  .update({ discord_id: discordId })
                  .eq("guild", guild).eq("gid", assignee.gid);
                if (saveError) {
                  output.errors.push(`${assignee.nickname}: 연결 계정 저장 실패`);
                  continue;
                }
              }
            }
          }
          if (!discordId) { output.pending.push(`${assignee.nickname}: Discord 계정 연결 필요`); continue; }
          const [linked, state] = await Promise.all([
            supabaseAdmin.from("guild_member_discord_links").select("gid")
              .eq("gid", assignee.gid).eq("discord_id", discordId)
              .is("revoked_at", null).maybeSingle(),
            supabaseAdmin.from("guild_member_states").select("status")
              .eq("gid", assignee.gid).maybeSingle(),
          ]);
          if (linked.error || !linked.data || state.error || state.data?.status !== "active") {
            output.pending.push(`${assignee.nickname}: 활성 계정 연결 확인 필요`);
            continue;
          }
          try {
            await requestDiscord(`/guilds/${guildId}/members/${discordId}/roles/${role.id}`, "PUT");
            output.assigned.push(assignee.nickname);
          } catch (error) {
            output.errors.push(`${assignee.nickname}: ${error instanceof Error ? error.message : "지급 실패"}`);
          }
        }
      } catch (error) {
        output.errors.push(error instanceof Error ? error.message : "역할 설정 실패");
      }
    }
    return NextResponse.json({ success: true, results,
      message: "역할 생성 및 지급 시도를 마쳤습니다. 미연결·실패 계정을 확인해주세요." });
  } catch (error) {
    return NextResponse.json({ success: false,
      message: error instanceof Error ? error.message : "Discord 역할 설정 실패" }, { status: 502 });
  }
}
