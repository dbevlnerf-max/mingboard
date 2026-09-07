import {
  supabaseAdmin,
} from "@/lib/supabase/admin";


type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE";


type WriteAuditLogParams = {
  action: AuditAction;

  targetType: string;

  targetId?: string | null;

  targetName?: string | null;

  actorDiscordId: string;

  actorName?: string | null;

  actorRole:
    | "MASTER"
    | "ADMIN";

  beforeData?:
    Record<
      string,
      unknown
    > | null;

  afterData?:
    Record<
      string,
      unknown
    > | null;

  description?: string | null;
};


export async function writeAuditLog({
  action,
  targetType,
  targetId = null,
  targetName = null,
  actorDiscordId,
  actorName = null,
  actorRole,
  beforeData = null,
  afterData = null,
  description = null,
}: WriteAuditLogParams) {

  try {

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "audit_logs"
        )
        .insert({
          action,

          target_type:
            targetType,

          target_id:
            targetId,

          target_name:
            targetName,

          actor_discord_id:
            actorDiscordId,

          actor_name:
            actorName,

          actor_role:
            actorRole,

          before_data:
            beforeData,

          after_data:
            afterData,

          description,
        })
        .select(
          "id"
        )
        .single();


    if (
      error
    ) {

      console.error(
        "AUDIT INSERT ERROR:",
        error
      );


      return {
        success: false,
        message:
          error.message,
      };
    }


    return {
      success: true,
      id:
        data.id,
    };


  } catch (
    error
  ) {

    console.error(
      "AUDIT UNEXPECTED ERROR:",
      error
    );


    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "감사로그 저장 실패",
    };
  }
}