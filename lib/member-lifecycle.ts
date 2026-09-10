import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

import {
  removeZeusRole,
} from "@/lib/discord";


export type MemberLifecycleStatus =
  | "active"
  | "left"
  | "banned";


export async function getMemberLifecycleStatus(
  gid: string | number
): Promise<MemberLifecycleStatus> {

  const numericGid =
    Number(gid);


  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "guild_member_states"
      )
      .select(
        "status"
      )
      .eq(
        "gid",
        numericGid
      )
      .maybeSingle();


  if (
    error
  ) {
    throw error;
  }


  if (
    data?.status ===
    "left"
  ) {
    return "left";
  }


  if (
    data?.status ===
    "banned"
  ) {
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

  const numericGid =
    Number(gid);


  if (
    !Number.isSafeInteger(
      numericGid
    ) ||
    numericGid <=
    0
  ) {
    throw new Error(
      "올바른 GID가 아닙니다."
    );
  }


  const now =
    new Date()
      .toISOString();


  const {
    data: links,
    error: linksError,
  } =
    await supabaseAdmin
      .from(
        "guild_member_discord_links"
      )
      .select(
        "id, gid, discord_id, discord_username, discord_display_name, account_type"
      )
      .eq(
        "gid",
        numericGid
      )
      .is(
        "revoked_at",
        null
      );


  if (
    linksError
  ) {
    throw linksError;
  }


  const {
    error: stateError,
  } =
    await supabaseAdmin
      .from(
        "guild_member_states"
      )
      .upsert(
        {
          gid:
            numericGid,
          status,
          left_at:
            status ===
            "active"
              ? null
              : now,
          updated_at:
            now,
          updated_by:
            actorDiscordId ||
            null,
          reason:
            reason ||
            null,
        },
        {
          onConflict:
            "gid",
        }
      );


  if (
    stateError
  ) {
    throw stateError;
  }


  if (
    status ===
    "active"
  ) {
    return {
      status,
      linksRevoked: 0,
      roleResults: [],
    };
  }


  const activeLinks =
    Array.isArray(
      links
    )
      ? links
      : [];


  if (
    activeLinks.length >
    0
  ) {
    const {
      error: revokeError,
    } =
      await supabaseAdmin
        .from(
          "guild_member_discord_links"
        )
        .update({
          revoked_at:
            now,
          revoke_reason:
            status ===
            "banned"
              ? "member_banned"
              : "member_left",
          updated_at:
            now,
        })
        .eq(
          "gid",
          numericGid
        )
        .is(
          "revoked_at",
          null
        );


    if (
      revokeError
    ) {
      throw revokeError;
    }
  }


  const roleResults =
    await Promise.all(
      activeLinks.map(
        link =>
          removeZeusRole(
            String(
              link.discord_id
            )
          )
      )
    );


  if (
    activeLinks.length >
    0
  ) {
    const {
      error: historyError,
    } =
      await supabaseAdmin
        .from(
          "member_access_history"
        )
        .insert(
          activeLinks.map(
            link => ({
              gid:
                numericGid,
              discord_id:
                String(
                  link.discord_id
                ),
              action:
                status ===
                "banned"
                  ? "member_banned"
                  : "member_left",
              detail:
                JSON.stringify({
                  reason:
                    reason ||
                    null,
                  roleRemoval:
                    roleResults.find(
                      result =>
                        result.discordId ===
                        String(
                          link.discord_id
                        )
                    ) ||
                    null,
                }),
            }))
        );


    if (
      historyError
    ) {
      console.error(
        "[member lifecycle history]",
        historyError
      );
    }
  }


  return {
    status,
    linksRevoked:
      activeLinks.length,
    roleResults,
  };
}
