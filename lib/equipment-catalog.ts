/**
 * Verified equipment icons are keyed by (slot, rarity, tier, exact item name).
 * Do not display an icon based on tier alone: T5 has multiple distinct items.
 */
import { normalizeSkillJob } from "@/lib/skill-catalog";

export type EquipmentRarity = "hero" | "rare" | "legendary";
export type EquipmentCatalogItem = {
  item_id: string;
  item_name: string;
  slot: string;
  rarity: EquipmentRarity;
  tier: number;
  equipment_kind: string;
  job_class: string;
  aliases: string[];
  icon_asset: string | null;
  sprite_index: number | null;
  sprite_columns: number;
  icon_verified: boolean;
};

/**
 * Verified class-equipment pairing, checked against the 2026-10-28
 * guild's 55-member equipment snapshot. The icon catalog has blank
 * job_class on all weapon/offhand records, so that field alone cannot
 * filter a class-specific equipment dropdown.
 *
 * These rules only filter item choices in the allocation preview.
 * They do not alter equipment ownership or invent class suitability
 * for newly introduced/unverified weapon types.
 */
export const EQUIPMENT_KINDS_BY_JOB: Record<
  string, { 무기: readonly string[]; 보조무기: readonly string[] }
> = {
  나이트: { 무기: ["한손검", "대검"], 보조무기: ["대형방패"] },
  버서커: { 무기: ["대검"], 보조무기: ["완갑"] },
  어쌔신: { 무기: ["단검"], 보조무기: ["사슬검"] },
  레인저: { 무기: ["활"], 보조무기: ["조준경"] },
  오라클: { 무기: ["보주"], 보조무기: ["팔찌"] },
  엘리멘탈리스트: { 무기: ["지팡이"], 보조무기: ["마법서"] },
  블레스드: { 무기: ["철퇴"], 보조무기: ["소형방패"] },
  아티산: { 무기: ["망치"], 보조무기: ["천칭"] },
};

/** Filter equipment selections by class even when catalog.job_class is empty. */
export function equipmentAvailableForJob(
  item: EquipmentCatalogItem,
  job: string,
): boolean {
  const currentJob = normalizeSkillJob(job);
  if (!currentJob || currentJob === "전체") return true;
  if (item.job_class && normalizeSkillJob(item.job_class) !== currentJob) {
    return false;
  }
  if (item.slot !== "무기" && item.slot !== "보조무기") return true;
  const allowed = EQUIPMENT_KINDS_BY_JOB[currentJob];
  if (!allowed) return false;
  const kind = String(item.equipment_kind || "").replace(/\s+/g, "");
  return allowed[item.slot].includes(kind);
}

type AnalyzedEquipment = {
  name: string;
  tier: number | null;
  rarity: EquipmentRarity | "unclassified";
};

export function analyzeEquipmentItem(raw: string): AnalyzedEquipment {
  const cleaned = String(raw || "")
    .normalize("NFKC")
    .replace(/[（(][^)）]*[)）]/g, " ")
    .replace(/[+＋]\s*\d+/g, " ")
    .trim();
  // Both "6t 위대한 단검" and "승리의 단검 T4" occur in the source sheets.
  const tierPattern = /(?:^|\s)(?:[tT]\s*(\d+)|(\d+)\s*[tT])(?=\s|[가-힣]|$)/;
  const found = tierPattern.exec(cleaned);
  const tier = found ? Number(found[1] || found[2]) : null;
  const hero = /^영웅\s*(?:(?:\d+\s*[tT])|(?:[tT]\s*\d+))/.test(cleaned) ||
    /^영웅의\s*/.test(cleaned);
  const name = cleaned
    .replace(/(?:^|\s)(?:[tT]\s*\d+|\d+\s*[tT])(?=\s|[가-힣]|$)/g, " ")
    .replace(/^영웅\s+(?=[가-힣])/, " ")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
  return {
    name,
    tier,
    rarity: hero ? "hero" : tier !== null && tier >= 4 ? "rare" : "unclassified",
  };
}

/**
 * Equipment panel label only: strip source-sheet grade/tier and purchase notes.
 * Leave the real item adjective ("수호자의", "영웅의", "위대한") intact.
 * Full source text is still retained for tooltips, GID mapping and database lookups.
 */
export function displayEquipmentName(raw: string): string {
  const original = String(raw || "").normalize("NFKC").trim();
  if (!original) return "미기록";
  const withoutNotes = original.replace(/\s*[（(]\s*개인\s*구매\s*[)）]\s*/g, " ").trim();
  const withoutTier = withoutNotes
    .replace(/^\s*영웅\s*(?:(?:[tT]\s*\d+)|(?:\d+\s*[tT]))(?:\s+|(?=[가-힣]))/i, "")
    .replace(/^\s*(?:(?:[tT]\s*\d+)|(?:\d+\s*[tT]))(?:\s+|(?=[가-힣]))/i, "")
    .trim()
    // Display the Knight shield label as written in the UI; keep the sheet value intact.
    .replace(/수호자의\s*방패/g, "수호자의 방패");
  return withoutTier || original;
}

export function eligibleForItemIcon(item: AnalyzedEquipment): boolean {
  return item.tier !== null &&
    (item.rarity === "hero" || item.rarity === "legendary" ||
      (item.rarity === "rare" && item.tier >= 4));
}

export function matchEquipmentIcon(
  itemName: string,
  slot: string,
  memberJob: string,
  catalog: EquipmentCatalogItem[],
): EquipmentCatalogItem | null {
  const source = analyzeEquipmentItem(itemName);
  if (!eligibleForItemIcon(source)) return null;
  for (const entry of catalog) {
    if (!entry.icon_verified || !entry.icon_asset ||
        !entry.icon_asset.startsWith("/equipment/icons/") ||
        entry.slot !== slot || entry.tier !== source.tier ||
        entry.rarity !== source.rarity) continue;
    if (entry.job_class && memberJob && entry.job_class !== memberJob) continue;
    const candidates = [entry.item_name, ...(entry.aliases || [])];
    if (candidates.some(alias =>
      analyzeEquipmentItem(alias).name === source.name)) return entry;
  }
  return null;
}
