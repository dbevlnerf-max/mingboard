import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Permanent nickname reservation across active, departed and historical GIDs.
 * A past name may be reused by the SAME GID only, never by a different GID.
 * NULL owner_gid denotes ambiguous ownership / an old distribution ledger
 * recipient without a confirmed GID. Such names are locked to everyone.
 */
export const nicknameKey = (name: string): string =>
  String(name || "").trim().normalize("NFKC").toLocaleLowerCase("ko-KR");

export async function findHistoricalNicknameConflict(
  candidate: string,
  gid?: string | number | null
): Promise<{ displayName: string; ownerGid: string | null } | null> {
  const key = nicknameKey(candidate);
  if (!key) throw new Error("닉네임이 비어 있습니다.");
  const { data, error } = await supabaseAdmin
    .from("guild_nickname_registry")
    .select("display_name,owner_gid")
    .eq("name_key", key)
    .maybeSingle();
  if (error) {
    console.error("[닉네임 사용이력 조회 실패]", error.code);
    throw new Error("닉네임 사용이력을 확인하지 못했습니다.");
  }
  if (!data) return null;
  if (gid != null && data.owner_gid != null &&
      String(data.owner_gid) === String(gid)) return null;
  return {
    displayName: String(data.display_name || candidate),
    ownerGid: data.owner_gid == null ? null : String(data.owner_gid),
  };
}

export const reservedNicknameMessage =
  "과거 다른 캐릭터가 사용했거나 분배 기록에 남아 있는 닉네임은 재사용할 수 없습니다. 닉네임과 GID의 기록이 섞이지 않도록 제한합니다.";
