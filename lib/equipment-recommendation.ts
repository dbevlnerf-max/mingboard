// Read-only suggestion engine. No inventory or distribution records are mutated.
export type EquipmentSlot = {
  slot: string;
  item: string;
  enhancement: string;
  personal: boolean;
};
export type EquippedMember = {
  gid: string;
  nickname: string;
  sourceNickname: string;
  guild: string;
  job: string;
  growthPower: string;
  slots: EquipmentSlot[];
  rosterMatched?: boolean;
};
export type Suggestion = {
  gid: string;
  nickname: string;
  job: string;
  guild: string;
  currentItem: string;
  gainedTiers: number;
  reasons: string[];
  chain: Array<{ gid: string; nickname: string; receives: string; before: string }>;
};
export const EQUIPMENT_SLOTS = [
  "무기", "보조무기", "투구", "상의", "장갑", "망토",
  "신발", "하의", "귀걸이", "허리띠", "목걸이", "반지",
] as const;
type Tier = { group: "hero" | "normal"; level: number };
export function getEquipmentTier(item: string): Tier | null {
  const v = item.replace(/\s+/g, " ").trim();
  const hero = v.match(/^영웅\s*(\d+)\s*[tT]\b/i);
  if (hero) return { group: "hero", level: Number(hero[1]) };
  const normal = v.match(/\b(\d+)\s*[tT]\b/i) || v.match(/[tT]\s*(\d+)\b/);
  if (normal) return { group: "normal", level: Number(normal[1]) };
  return null;
}
const WEAPON_KINDS = ["대형방패", "소형방패", "한손검", "대검", "단검", "활", "석궁", "지팡이", "보주", "망치", "철퇴", "창", "도끼", "방패", "완갑", "마법서", "조준경", "사슬검", "천칭", "팔찌"];
export function equipmentKind(item: string, slot: string): string | null {
  if (slot !== "무기" && slot !== "보조무기") return slot;
  return WEAPON_KINDS.find(kind => item.includes(kind)) || null;
}
/** Ordinary T4 or lower equipment is never handed down in a succession.
 * Hero equipment remains reviewable within its separate hero tier system. */
export function eligibleForHandDown(item: string): boolean {
  const tier = getEquipmentTier(item);
  return Boolean(tier && (tier.group === "hero" || tier.level >= 5));
}

function comparable(offered: string, worn: string, slot: string) {
  const newTier = getEquipmentTier(offered);
  const oldTier = getEquipmentTier(worn);
  if (!newTier || !oldTier) return null;
  if (slot === "무기" || slot === "보조무기") {
    const newKind = equipmentKind(offered, slot);
    const oldKind = equipmentKind(worn, slot);
    if (!newKind || !oldKind || newKind !== oldKind) return null;
  }
  if (newTier.group !== oldTier.group) return newTier.group === "hero" ? 1 : null;
  return newTier.level - oldTier.level;
}
export function recommendEquipment(
  members: EquippedMember[],
  slot: string,
  newItem: string,
  options: { candidateJob?: string; limit?: number } = {},
): { suggestions: Suggestion[]; excluded: number; message: string } {
  const proposed = newItem.trim();
  if (!EQUIPMENT_SLOTS.some(v => v === slot) || !proposed) {
    return { suggestions: [], excluded: 0, message: "부위와 새 아이템을 입력해주세요." };
  }
  if (!getEquipmentTier(proposed)) {
    return { suggestions: [], excluded: members.length,
      message: "새 아이템의 티어를 식별할 수 없어 자동 비교하지 않았습니다. 티어 표기를 확인해주세요." };
  }
  const selectedJob = options.candidateJob?.replace("앨리멘탈리스트", "엘리멘탈리스트");
  const targetMembers = selectedJob
    ? members.filter(m => m.job.replace("앨리멘탈리스트", "엘리멘탈리스트") === selectedJob)
    : members;
  const candidates = targetMembers.flatMap(member => {
    const worn = member.slots.find(s => s.slot === slot);
    if (!worn?.item) return [];
    const delta = comparable(proposed, worn.item, slot);
    if (delta === null || delta <= 0) return [];
    return [{ member, worn, delta }];
  });
  const suggestions = candidates.map(({ member, worn, delta }) => {
    const chain: Suggestion["chain"] = [{
      gid: member.gid, nickname: member.nickname, receives: proposed, before: worn.item,
    }];
    // Personal purchases cannot be redistributed automatically.
    if (!worn.personal && !/개인구매/.test(worn.item) && eligibleForHandDown(worn.item)) {
      const next = members
        .filter(other => other.gid !== member.gid && other.guild === member.guild)
        .flatMap(other => {
          const used = other.slots.find(s => s.slot === slot);
          if (!used?.item) return [];
          const gain = comparable(worn.item, used.item, slot);
          if (gain === null || gain <= 0) return [];
          return [{ other, used, gain }];
        }).sort((a, b) => b.gain - a.gain ||
          a.other.nickname.localeCompare(b.other.nickname, "ko"))[0];
      if (next) chain.push({
        gid: next.other.gid, nickname: next.other.nickname,
        receives: worn.item, before: next.used.item,
      });
    }
    return {
      gid: member.gid, nickname: member.nickname,
      job: member.job, guild: member.guild, currentItem: worn.item,
      gainedTiers: delta,
      chain,
      reasons: [
        "동일 장비 부위 및 비교 가능한 장비 종류",
        getEquipmentTier(proposed)?.group !== getEquipmentTier(worn.item)?.group
          ? "희귀 장비에서 영웅 장비로 등급 상승"
          : "동일 등급에서 " + delta + "티어 상승",
        chain.length > 1 ? "기존 장비를 같은 길드의 하위 장비 사용자에게 계승 가능" :
          worn.personal ? "개인 구매 장비는 계승에서 제외" :
          !eligibleForHandDown(worn.item) ? "T4 이하 일반 장비는 후속 계승 제외" :
          "안전한 후속 계승 대상 미확정",
      ],
    };
  }).sort((a, b) => b.gainedTiers - a.gainedTiers ||
    b.chain.length - a.chain.length ||
    a.nickname.localeCompare(b.nickname, "ko"));
  return {
    suggestions: suggestions.slice(0, Math.max(1, options.limit ?? 5)),
    excluded: Math.max(0, targetMembers.length - candidates.length),
    message: suggestions.length ? "장비의 등급 또는 티어 상승을 기준으로 계산한 참고 추천입니다." :
      "비교 가능한 착용 장비에서 명확한 등급·티어 상승 대상을 찾지 못했습니다.",
  };
}
