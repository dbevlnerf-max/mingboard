import type { EquippedMember } from "@/lib/equipment-recommendation";
import { classHeroSkills, normalizeSkillJob, normalizeSkillName,
  SKILL_SPRITE, SKILL_SPRITE_COLUMNS } from "@/lib/skill-catalog";
import styles from "./equipment.module.css";

type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};
function aliases(member: EquippedMember) {
  const names = new Set<string>();
  for (const label of [member.nickname, member.sourceNickname]) {
    names.add(label.replace(/\s+/g,"").toLocaleLowerCase("ko-KR"));
    for (const part of label.split(/[()]/)) {
      if (part.trim()) names.add(part.replace(/\s+/g,"").toLocaleLowerCase("ko-KR"));
    }
  }
  return names;
}
export default function SkillDistributionCard({
  member, history, compact = false,
}: {member: EquippedMember; history: History[]; compact?: boolean}) {
  const skills = classHeroSkills(member.job);
  const names = aliases(member);
  const job = normalizeSkillJob(member.job);
  const awarded = history.filter(row =>
    row.category === "영웅스킬" &&
    names.has(row.target.replace(/\s+/g,"").toLocaleLowerCase("ko-KR")) &&
    (!row.job.trim() || normalizeSkillJob(row.job) === job)
  );
  return <section className={compact ? `${styles.skillSection} ${styles.skillSectionCompact}` : styles.skillSection} aria-label="직업별 영웅 스킬 분배">
    <div className={styles.skillSectionHeader}>
      <h3>영웅 스킬 분배</h3>
      <span>{job} · 최대 2종</span>
    </div>
    {!compact && <p className={styles.skillSubtext}>장비 슬롯과 별도로, 해당 직업의 영웅 스킬 2종과 길드 분배 기록을 보여줍니다.</p>}
    {skills.length === 2 ? <div className={styles.skillGrid}>
      {skills.map(skill => {
        const record = awarded.filter(row =>
          normalizeSkillName(row.item) === normalizeSkillName(skill.name))
          .sort((a, b) => b.row - a.row)[0];
        const px = 58;
        return <div key={skill.name} className={styles.skillCard}>
          <span role="img" aria-label={skill.name + " 아이콘"}
            className={styles.skillArt}
            style={{
              backgroundImage: `url("${SKILL_SPRITE}")`,
              backgroundSize: `${SKILL_SPRITE_COLUMNS * px}px ${px}px`,
              backgroundPosition: `${-skill.index * px - 2}px -2px`,
              backgroundRepeat: "no-repeat",
            }} />
          <div className={styles.skillDetail}>
            <small>영웅 스킬 {skill.rank}</small>
            <strong>{skill.name}</strong>
            <span className={record ? styles.skillOwned : styles.skillUnconfirmed}>
              {record ? `분배 기록 확인 · ${record.date}` : "분배 기록 없음"}
            </span>
          </div>
        </div>;
      })}
    </div> : <p className={styles.skillSubtext}>해당 직업의 영웅 스킬 이름이 아직 확인되지 않았습니다.</p>}
    {!compact && <p className={styles.skillFootnote}>※ 분배 기록 확인은 지급 내역과 닉네임을 대조한 결과이며, 현재 습득·보유 확정은 아닙니다. 닉네임 변경 이전 기록은 누락될 수 있습니다.</p>}
  </section>;
}
