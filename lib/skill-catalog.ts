/**
 * Item data from the 2026-10-28 skillbook archive. The first title in each
 * class group is not an allocated hero skill; only the final two are hero slots.
 * The archive's last trio has no confirmed class name, so is not assigned.
 */
export type HeroSkill = { name: string; job: string; index: number; rank: number };
export const HERO_SKILLS: HeroSkill[] = [
  {name:"코드 오브 아너",job:"나이트",index:1,rank:1},
  {name:"카르믹 리플렉션",job:"나이트",index:2,rank:2},
  {name:"워 플로우",job:"버서커",index:4,rank:1},
  {name:"버서크 오스",job:"버서커",index:5,rank:2},
  {name:"베일 스텝",job:"어쌔신",index:7,rank:1},
  {name:"보이드 러시",job:"어쌔신",index:8,rank:2},
  {name:"헌팅 포커스",job:"레인저",index:10,rank:1},
  {name:"쓰러스트",job:"레인저",index:11,rank:2},
  {name:"스펠 오버로드",job:"엘리멘탈리스트",index:13,rank:1},
  {name:"앱솔루트 엘리멘탈",job:"엘리멘탈리스트",index:14,rank:2},
  {name:"블레스드 도미니언",job:"오라클",index:16,rank:1},
  {name:"그레이스 익스플로전",job:"오라클",index:17,rank:2},
  {name:"플레일 템포",job:"블레스드",index:19,rank:1},
  {name:"퓨어 빌리버",job:"블레스드",index:20,rank:2},
  {name:"골드 밤!",job:"아티산",index:22,rank:1},
  {name:"머천트 인듀어런스",job:"아티산",index:23,rank:2},
];
export const SKILL_SPRITE = "/equipment/icons/hq-skill-20261028.webp";
export const SKILL_SPRITE_COLUMNS = 27;
export function normalizeSkillName(name: string): string {
  return String(name || "").normalize("NFKC")
    .replace(/블래스드/g,"블레스드")
    .replace(/[\s\-_.!！]/g,"").toLocaleLowerCase("ko-KR");
}
export function normalizeSkillJob(name: string): string {
  const v = String(name || "").replace(/\s+/g,"").trim();
  if (v === "앨리멘탈리스트") return "엘리멘탈리스트";
  if (v === "어쎄신") return "어쌔신";
  return v;
}
export function classHeroSkills(job: string): HeroSkill[] {
  return HERO_SKILLS.filter(s => s.job === normalizeSkillJob(job));
}
