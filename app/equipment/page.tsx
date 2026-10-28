"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppTopBar from "@/app/components/AppTopBar";
import DataStatus from "@/app/components/DataStatus";
import { usePortalQuery } from "@/lib/use-portal-query";
import {
  EQUIPMENT_SLOTS, getEquipmentTier, recommendEquipment,
  type EquippedMember,
} from "@/lib/equipment-recommendation";
import EquipmentSlotCard from "./EquipmentSlotCard";
import EquipmentMannequin from "./EquipmentMannequin";
import SkillDistributionCard from "./SkillDistributionCard";
import type { EquipmentCatalogItem } from "@/lib/equipment-catalog";
import styles from "./equipment.module.css";

type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};
type EquipmentResponse = {
  success: boolean; message?: string; members?: EquippedMember[];
  catalog?: EquipmentCatalogItem[];
  history?: History[]; skillHistory?: History[]; rosterTotal?: number; updatedAt?: string | null;
  sourceSummary?: { equipmentDistributionRows?: number };
  rankingByGid?: Record<string, {
    jobRank: number; jobTotal: number; overallRank: number; overallTotal: number;
  }>;
};
function formatPower(s: string) {
  const n = Number(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("ko-KR") : "—";
}
function cleanName(n: string) { return n.replace(/\s+/g, "").trim(); }
function nickAliases(member: EquippedMember) {
  const result = new Set([cleanName(member.nickname), cleanName(member.sourceNickname)]);
  for (const label of [member.nickname, member.sourceNickname]) {
    const cleaned = label.replace(/\n/g, " ").trim();
    for (const part of cleaned.split(/[()]/).map(s => cleanName(s)).filter(Boolean)) {
      result.add(part);
    }
  }
  return result;
}
function tierText(s: string) {
  const tier = getEquipmentTier(s);
  return tier ? (tier.group === "hero" ? "영웅 " : "") + "T" + tier.level : "등급 미확인";
}

// Display order is visual only: keep exact source slot names for icon lookup and data.
const EQUIPMENT_PAIR_ROWS = [
  { left: "무기", right: "보조무기" },
  { left: "투구", right: "상의" },
  { left: "장갑", right: "망토" },
  { left: "신발", right: "하의" },
  { left: "귀걸이", right: "허리띠" },
  { left: "목걸이", right: "반지" },
] as const;
const EQUIPMENT_LABELS: Record<string, string> = {
  상의: "갑옷", 하의: "바지",
};

export default function EquipmentPage() {
  const { data: session, status } = useSession();
  const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.isMaster);
  const canRead = status === "authenticated" && isAdmin;
  const query = usePortalQuery<EquipmentResponse>(
    canRead ? "/api/equipment" : null, { arrayField: "members" }
  );
  const members = useMemo(() => query.data?.members ?? [], [query.data?.members]);
  const catalog = useMemo(() => query.data?.catalog ?? [], [query.data?.catalog]);
  const history = useMemo(() => query.data?.history ?? [], [query.data?.history]);
  const skillHistory = useMemo(() => query.data?.skillHistory ?? [], [query.data?.skillHistory]);
  const combinedHistory = useMemo(
    () => [...history, ...skillHistory].sort((a, b) => a.row - b.row),
    [history, skillHistory],
  );
  const [search, setSearch] = useState("");
  const [guildFilter, setGuildFilter] = useState("전체");
  const [selectedGid, setSelectedGid] = useState("");
  const [view, setView] = useState<"inventory" | "history">("inventory");
  const [newSlot, setNewSlot] = useState<string>("무기");
  const [newItem, setNewItem] = useState("");
  const [calculated, setCalculated] = useState(false);
  const [highlightedEquipmentSlot, setHighlightedEquipmentSlot] = useState<string | null>(null);

  const guilds = useMemo(() =>
    ["전체", ...new Set(members.map(m => m.guild).filter(Boolean))], [members]
  );
  const filtered = useMemo(() => members.filter(member => (
    (guildFilter === "전체" || member.guild === guildFilter) &&
    (!search.trim() || [member.nickname, member.sourceNickname, member.job, member.gid]
      .some(v => cleanName(v || "").toLowerCase().includes(cleanName(search).toLowerCase())))
  )), [members, guildFilter, search]);
  const selected = filtered.find(m => m.gid === selectedGid) ?? filtered[0] ?? null;
  const recent = useMemo(() => {
    if (!selected) return [];
    const aliases = nickAliases(selected);
    return combinedHistory.filter(h => aliases.has(cleanName(h.target))).slice(-40).reverse();
  }, [selected, combinedHistory]);
  const distributionTotal = recent.length;
  const proposal = useMemo(() => calculated ?
    recommendEquipment(members, newSlot, newItem) : null,
  [calculated, members, newSlot, newItem]);

  if (status === "loading") return <main className={styles.state}>Discord 인증 상태를 확인 중입니다.</main>;
  if (!canRead) return (
    <main className={styles.state}>
      <h1>장비 현황 조회 권한이 없습니다.</h1>
      <p>관리자(ADMIN 또는 MASTER)만 장비 현황을 조회할 수 있습니다.</p>
    </main>
  );

  return (
    <main className={styles.root}>
      <AppTopBar />
      <div className={styles.shell}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>GUILD EQUIPMENT</span>
            <h1>길드원 착용장비</h1>
            <p>현재 장비는 구글시트 <b>길드원 착용장비</b> 기준으로 표시합니다. 분배 기록은 별도 이력입니다.</p>
          </div>
          <button type="button" className={styles.outline} onClick={() => query.refresh()}
            disabled={query.loading || query.refreshing}>↻ 새로고침</button>
        </div>
        <DataStatus {...query} />
        <div className={styles.summary}>
          <div><span>장비 조사 완료</span><strong>{members.length}명</strong></div>
          <div><span>전체 길드현황</span><strong>{query.data?.rosterTotal ?? "—"}명</strong></div>
          <div><span>장비 분배 기록</span><strong>{query.data?.sourceSummary?.equipmentDistributionRows ?? history.length}건</strong></div>
          <div><span>자료 수집 시각</span><strong className={styles.smallStrong}>{query.data?.updatedAt ? new Date(query.data.updatedAt).toLocaleString("ko-KR", {timeZone:"Asia/Seoul"}) : "—"}</strong></div>
        </div>
        {query.error && !query.data && <div className={styles.warning}>{query.error}</div>}
        {!query.loading && query.data && <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sideTitle}>길드원 찾기 <small>{filtered.length}명</small></div>
            <input className={styles.input} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="닉네임 · GID · 직업 검색" aria-label="길드원 검색" />
            <select className={styles.select} value={guildFilter} onChange={e => setGuildFilter(e.target.value)}
              aria-label="길드 필터">
              {guilds.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <div className={styles.memberList}>
              {filtered.map(m => <button key={m.gid} type="button"
                onClick={() => { setSelectedGid(m.gid); setView("inventory"); }}
                className={selected?.gid === m.gid ? styles.memberActive : styles.member}>
                <span className={styles.memberIcon}>{m.nickname.slice(0, 1)}</span>
                <span className={styles.memberText}>
                  <strong>{m.nickname}</strong>
                  <small>{m.job} · {m.guild}</small>
                </span>
                <span className={styles.memberPower}>{formatPower(m.growthPower)}</span>
              </button>)}
              {filtered.length === 0 && <p className={styles.empty}>검색 결과가 없습니다.</p>}
            </div>
          </aside>
          <div className={styles.mainColumn}>
            {selected ? <>
              <div className={styles.tabs}>
                <button className={view === "inventory" ? styles.tabActive : styles.tab} onClick={() => setView("inventory")}>착용 인벤토리</button>
                <button className={view === "history" ? styles.tabActive : styles.tab} onClick={() => setView("history")}>분배 이력</button>
              </div>
              {view === "inventory" ? <section className={styles.inventoryPanel}>
                <div className={styles.inventoryTop}>
                  <div className={styles.characterDisplay}>
                    <span className={styles.characterCircle} aria-hidden="true">⚔</span>
                    <div className={styles.characterInfo}>
                      <span className={styles.characterMeta}>{selected.guild} · GID {selected.gid}</span>
                      <strong>{selected.nickname}</strong>
                      <span className={styles.characterJob}>{selected.job} · 성장력 {formatPower(selected.growthPower)}</span>
                      <div className={styles.inlineRanks} aria-label="성장력 랭킹정보">
                        <div>
                          <span>{selected.job} 순위</span>
                          <b>{query.data?.rankingByGid?.[selected.gid]
                            ? `${query.data.rankingByGid[selected.gid].jobRank}/${query.data.rankingByGid[selected.gid].jobTotal}`
                            : "—"}</b>
                        </div>
                        <div>
                          <span>전직업 순위</span>
                          <b>{query.data?.rankingByGid?.[selected.gid]
                            ? `${query.data.rankingByGid[selected.gid].overallRank}/${query.data.rankingByGid[selected.gid].overallTotal}`
                            : "—"}</b>
                        </div>
                      </div>
                    </div>
                  </div>
                  <SkillDistributionCard member={selected} history={skillHistory} compact />
                </div>
                <div className={styles.inventoryLeft}>
                  {EQUIPMENT_PAIR_ROWS.map(({ left }) => {
                    const slot = selected.slots.find(item => item.slot === left);
                    return slot ? <EquipmentSlotCard key={left} slot={slot} job={selected.job}
                      catalog={catalog} displaySlot={EQUIPMENT_LABELS[left] || left}
                      highlighted={highlightedEquipmentSlot === left}
                      onActiveChange={setHighlightedEquipmentSlot} /> : null;
                  })}
                </div>
                <EquipmentMannequin activeSlot={highlightedEquipmentSlot} />
                <div className={styles.inventoryRight}>
                  {EQUIPMENT_PAIR_ROWS.map(({ right }) => {
                    const slot = selected.slots.find(item => item.slot === right);
                    return slot ? <EquipmentSlotCard key={right} slot={slot} job={selected.job}
                      catalog={catalog} displaySlot={EQUIPMENT_LABELS[right] || right}
                      highlighted={highlightedEquipmentSlot === right}
                      onActiveChange={setHighlightedEquipmentSlot} /> : null;
                  })}
                </div>
                <p className={styles.panelNote}>※ 검증된 장비만 실제 아이콘을 표시합니다(희귀 T4 이상 또는 영웅). 개인구매 및 강화 수치는 원본을 유지하며, 캐릭터 스크린샷 연동은 별도로 진행합니다.</p>
              </section> :
              <section className={styles.historyPanel}>
                <div className={styles.panelTitle}>
                  <h3>{selected.nickname} 분배 기록</h3>
                  <span>{distributionTotal}건 표시</span>
                </div>
                <p className={styles.muted}>현재/과거 이름의 문자열이 일치하는 장비·영웅스킬 분배 기록입니다. 착용·소유 확정 기록이 아닙니다.</p>
                {recent.length ? <div className={styles.historyList}>{recent.map(h =>
                  <div className={styles.historyRow} key={h.row}>
                    <time>{h.date}</time><strong>{h.item}</strong>
                    <span>{h.category}</span><span>{h.diamond ? h.diamond + " 💎" : "—"}</span>
                  </div>
                )}</div> : <p className={styles.empty}>연결 가능한 분배 기록이 없습니다.</p>}
              </section>}
            </> : <section className={styles.emptyPanel}>장비가 등록된 길드원이 없습니다.</section>}
            {isAdmin && <section className={styles.adminPanel}>
              <div className={styles.panelTitle}><div>
                <span className={styles.eyebrow}>ADMIN · PREVIEW ONLY</span>
                <h3>신규 장비 분배 · 계승 시뮬레이션</h3>
              </div><span className={styles.profileBadge}>관리자 전용</span></div>
              <p className={styles.muted}>실제 분배를 기록하지 않는 미리보기입니다. 직업 적합성·참여도·개인 장비 회수 여부는 운영진 최종 확인이 필요합니다.</p>
              <div className={styles.formLine}>
                <label>장비 부위
                  <select className={styles.select} value={newSlot}
                    onChange={e => {setNewSlot(e.target.value);setCalculated(false);}}>
                    {EQUIPMENT_SLOTS.map(s => <option value={s} key={s}>{s}</option>)}
                  </select>
                </label>
                <label>새 아이템 이름
                  <input className={styles.input} value={newItem}
                    placeholder="예: 6t 위대한 대검"
                    onChange={e => {setNewItem(e.target.value);setCalculated(false);}} />
                </label>
                <button type="button" className={styles.primary} onClick={() => setCalculated(true)}>
                  추천 계산
                </button>
              </div>
              {proposal && <>
                <div className={styles.suggestionNote}>{proposal.message} · 비교/적합성 미확인 {proposal.excluded}명</div>
                {proposal.suggestions.map((s,i) => <article className={styles.suggestion} key={s.gid}>
                  <div className={styles.suggestionTitle}>
                    <strong>{i+1}순위 · {s.nickname}</strong>
                    <span>{s.job} / {s.guild} · 비교 티어 +{s.gainedTiers}</span>
                  </div>
                  <div className={styles.chain}>{s.chain.map((step,index) =>
                    <div key={step.gid} className={styles.chainItem}>
                      <b>{index+1}. {step.nickname}</b>
                      <span>{step.before} → {step.receives}</span>
                    </div>)}</div>
                  <p>{s.reasons.join(" · ")}</p>
                </article>)}
              </>}
            </section>}
          </div>
        </div>}
      </div>
    </main>
  );
}
