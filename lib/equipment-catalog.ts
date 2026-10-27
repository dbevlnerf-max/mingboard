/**
 * Verified equipment icons are keyed by (slot, rarity, tier, exact item name).
 * Do not display an icon based on tier alone: T5 has multiple distinct items.
 */
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
  icon_verified: boolean;
};

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
