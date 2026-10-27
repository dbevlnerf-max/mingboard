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
import styles from "./equipment.module.css";

type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};
type EquipmentResponse = {
  success: boolean; message?: string; members?: EquippedMember[];
  history?: History[]; rosterTotal?: number; updatedAt?: string | null;
  sourceSummary?: { equipmentDistributionRows?: number };
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

export default function EquipmentPage() {
  const { data: session, status } = useSession();
  const canRead = status === "authenticated" && Boolean(
    (session?.user?.isGuildMember && session.user.hasZeusRole) ||
    session?.user?.isAdmin || session?.user?.isMaster
  );
  const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.isMaster);
  const query = usePortalQuery<EquipmentResponse>(
    canRead ? "/api/equipment" : null, { arrayField: "members" }
  );
  const members = useMemo(() => query.data?.members ?? [], [query.data?.members]);
  const history = useMemo(() => query.data?.history ?? [], [query.data?.history]);
  const [search, setSearch] = useState("");
  const [guildFilter, setGuildFilter] = useState("전체");
  const [selectedGid, setSelectedGid] = useState("");
  const [view, setView] = useState<"inventory" | "history">("inventory");
  const [newSlot, setNewSlot] = useState<string>("무기");
  const [newItem, setNewItem] = useState("");
  const [calculated, setCalculated] = useState(false);

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
    return history.filter(h => aliases.has(cleanName(h.target))).slice(-40).reverse();
  }, [selected, history]);
  const distributionTotal = recent.length;
  const proposal = useMemo(() => calculated ?
    recommendEquipment(members, newSlot, newItem) : null,
  [calculated, members, newSlot, newItem]);

  if (status === "loading") return <main className={styles.state}>Discord 인증 상태를 확인 중입니다.</main>;
  if (!canRead) return (
    <main className={styles.state}>
      <h1>장비 현황 조회 권한이 없습니다.</h1>
      <p>밍보드에 로그인하고 길드원 역할을 인증해주세요.</p>
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
              <section className={styles.profile}>
                <div className={styles.avatar}>{selected.nickname.slice(0, 1)}</div>
                <div>
                  <span className={styles.eyebrow}>{selected.guild} · GID {selected.gid}</span>
                  <h2>{selected.nickname}</h2>
                  <p>{selected.job} <span className={styles.muted}>· 성장력 {formatPower(selected.growthPower)}</span></p>
                </div>
                <span className={styles.profileBadge}>착용장비 12부위</span>
              </section>
              <div className={styles.tabs}>
                <button className={view === "inventory" ? styles.tabActive : styles.tab} onClick={() => setView("inventory")}>착용 인벤토리</button>
                <button className={view === "history" ? styles.tabActive : styles.tab} onClick={() => setView("history")}>분배 이력</button>
              </div>
              {view === "inventory" ? <section className={styles.inventoryPanel}>
                <div className={styles.inventoryLeft}>
                  {selected.slots.slice(0, 6).map(slot => <div className={styles.equipmentSlot} key={slot.slot}>
                    <span className={styles.slotIcon}>◆</span>
                    <span><small>{slot.slot}</small><strong title={slot.item}>{slot.item || "미기록"}</strong></span>
                    {slot.item && <em>{tierText(slot.item)}{slot.enhancement ? " · " + (slot.enhancement.startsWith("+") ? "" : "+") + slot.enhancement : ""}</em>}
                  </div>)}
                </div>
                <div className={styles.characterDisplay}>
                  <span className={styles.characterCircle}>⚔</span>
                  <strong>{selected.nickname}</strong>
                  <span>{selected.job}</span>
                  <small>캐릭터 사진은 원본 시트에서 확인</small>
                </div>
                <div className={styles.inventoryRight}>
                  {selected.slots.slice(6, 12).map(slot => <div className={styles.equipmentSlot} key={slot.slot}>
                    <span className={styles.slotIcon}>◆</span>
                    <span><small>{slot.slot}</small><strong title={slot.item}>{slot.item || "미기록"}</strong></span>
                    {slot.item && <em>{tierText(slot.item)}{slot.enhancement ? " · " + (slot.enhancement.startsWith("+") ? "" : "+") + slot.enhancement : ""}</em>}
                  </div>)}
                </div>
                <p className={styles.panelNote}>※ 개인구매 표기는 시트 원문을 그대로 유지합니다. 강화 수치가 별도 입력된 경우에만 표시하며, 장비 사진은 아직 웹으로 동기화되지 않았습니다.</p>
              </section> :
              <section className={styles.historyPanel}>
                <div className={styles.panelTitle}>
                  <h3>{selected.nickname} 분배 기록</h3>
                  <span>{distributionTotal}건 표시</span>
                </div>
                <p className={styles.muted}>현재/과거 이름의 문자열이 일치하는 장비 분배 기록입니다. 착용·소유 확정 기록이 아닙니다.</p>
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
