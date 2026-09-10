import { supabaseAdmin } from "@/lib/supabase/admin";
import { removeZeusRole } from "@/lib/discord";

export type MemberLifecycleStatus =
  | "active"
  | "left"
  | "banned";

function nowIso() {
  return new Date().toISOString();
}

export async function getMemberStatus(
  gid: string | number
): Promise<MemberLifecycleStatus> {
  const numericGid = Number(gid);

  const { data, error } = await supabaseAdmin
    .from("guild_member_states")
    .select("status")
    .eq("gid", numericGid)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const value = String(data?.status || "active");

  if (value === "left") {
    return "left";
  }

  if (value === "banned") {
    return "banned";
  }

  return "active";
}

export async function setMemberLifecycleStatus({
  gid,
  status,
  actorDiscordId,
  reason,
}: {
  gid: string | number;
  status: MemberLifecycleStatus;
  actorDiscordId?: string | null;
  reason?: string | null;
}) {
  const numericGid = Number(gid);

  if (!Number.isSafeInteger(numericGid) || numericGid <= 0) {
    throw new Error("올바른 GID가 아닙니다.");
  }

  const timestamp = nowIso();
  const isRevoked = status !== "active";

  const { data: activeLinks, error: linkReadError } =
    await supabaseAdmin
      .from("guild_member_discord_links")
      .select(
        "id, gid, discord_id, discord_username, discord_display_name, account_type"
      )
      .eq("gid", numericGid)
      .is("revoked_at", null);

  if (linkReadError) {
    throw linkReadError;
  }

  const { error: stateError } = await supabaseAdmin
    .from("guild_member_states")
    .upsert(
      {
        gid: numericGid,
        status,
        left_at: status === "active" ? null : timestamp,
        updated_at: timestamp,
        updated_by: actorDiscordId || null,
        reason: reason || null,
      },
      {
        onConflict: "gid",
      }
    );

  if (stateError) {
    throw stateError;
  }

  if (!isRevoked) {
    await supabaseAdmin
      .from("member_access_history")
      .insert({
        gid: numericGid,
        discord_id: actorDiscordId || null,
        action: "member_reactivated",
        detail: reason || null,
      });

    return {
      status,
      linksRevoked: 0,
      roleResults: [],
    };
  }

  const links = Array.isArray(activeLinks) ? activeLinks : [];

  if (links.length > 0) {
    const { error: revokeError } = await supabaseAdmin
      .from("guild_member_discord_links")
      .update({
        revoked_at: timestamp,
        revoke_reason:
          status === "banned"
            ? "member_banned"
            : "member_left",
        updated_at: timestamp,
      })
      .eq("gid", numericGid)
      .is("revoked_at", null);

    if (revokeError) {
      throw revokeError;
    }
  }

  const roleResults = await Promise.all(
    links.map(link =>
      removeZeusRole(String(link.discord_id))
    )
  );

  const historyRows = links.map(link => ({
    gid: numericGid,
    discord_id: String(link.discord_id),
    action:
      status === "banned"
        ? "member_banned"
        : "member_left",
    detail: JSON.stringify({
      reason: reason || null,
      roleRemoval:
        roleResults.find(
          result =>
            result.discordId === String(link.discord_id)
        ) || null,
    }),
  }));

  if (historyRows.length > 0) {
    const { error: historyError } = await supabaseAdmin
      .from("member_access_history")
      .insert(historyRows);

    if (historyError) {
      console.error(
        "[member lifecycle] history save failed",
        historyError
      );
    }
  }

  return {
    status,
    linksRevoked: links.length,
    roleResults,
  };
}
