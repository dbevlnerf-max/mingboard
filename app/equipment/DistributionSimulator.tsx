"use client";
import { useMemo, useState } from "react";
import {
  EQUIPMENT_SLOTS, getEquipmentTier, equipmentKind, recommendEquipment, eligibleForHandDown,
  type EquippedMember,
} from "@/lib/equipment-recommendation";
import { classHeroSkills, normalizeSkillJob, normalizeSkillName } from "@/lib/skill-catalog";
import { displayEquipmentName, equipmentAvailableForJob, type EquipmentCatalogItem } from "@/lib/equipment-catalog";
import styles from "./equipment.module.css";

export type RosterPreviewMember = {
  gid: string; nickname: string; job: string; guild: string; growthPower: string;
};
type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};
type Props = {
  members: EquippedMember[];
  rosterMembers: RosterPreviewMember[];
  catalog: EquipmentCatalogItem[];
  skillHistory: History[];
};
const labelBySlot: Record<string,string> = { 상의:"갑옷", 하의:"바지" };
const power = (s: string) => {
  const n=Number(String(s || "").replace(/,/g,""));
  return Number.isFinite(n) ? n : 0;
};
const clean = (s: string) => String(s || "").normalize("NFKC")
  .replace(/\s+/g,"").toLocaleLowerCase("ko-KR");
const offered = (entry: EquipmentCatalogItem) =>
  (entry.rarity === "hero" ? "영웅 " : "") + entry.tier + "t " + entry.item_name;
const itemLabel = (entry: EquipmentCatalogItem) =>
  (entry.rarity === "hero" ? "영웅" : entry.rarity === "legendary" ? "전설" : "희귀") +
  " T" + entry.tier + " · " + entry.item_name;
/** Display a real tier and rarity, not a guessed rarity for unknown data. */
function GradeItem({ item }: { item: string }) {
  const tier = getEquipmentTier(item);
  const hero = tier?.group === "hero";
  const grade = tier ? (hero ? "영웅 T" : tier.level >= 4 ? "희귀 T" : "T") +
    tier.level + " · " : "";
  return <span className={hero ? styles.simItemHero :
    tier && tier.level >= 4 ? styles.simItemRare : styles.simItemUnknown}>
    {grade}{displayEquipmentName(item)}
  </span>;
}


export default function DistributionSimulator({members,rosterMembers,catalog,skillHistory}:Props) {
  const [category,setCategory]=useState<"equipment"|"skill">("equipment");
  const [slot,setSlot]=useState<string>("무기");
  const [job,setJob]=useState("전체");
  const [itemId,setItemId]=useState("");
  const [skillName,setSkillName]=useState("");
  const [showAll,setShowAll]=useState(false);
  const [copyState,setCopyState]=useState("");

  const activeGids=useMemo(()=>new Set(rosterMembers.map(m=>String(m.gid))),[rosterMembers]);
  const activeEquipment=useMemo(()=>members.filter(m=>
    !rosterMembers.length || activeGids.has(String(m.gid))
  ),[members,rosterMembers.length,activeGids]);
  const jobs=useMemo(()=>[...new Set(
    (rosterMembers.length ? rosterMembers : activeEquipment)
      .map(m=>normalizeSkillJob(m.job)).filter(Boolean)
  )].sort((a,b)=>a.localeCompare(b,"ko")),[rosterMembers,activeEquipment]);
  const selectedMembers=useMemo(()=>activeEquipment.filter(m=>
    job==="전체" || normalizeSkillJob(m.job)===job
  ),[activeEquipment,job]);

  const items=useMemo(()=>catalog.filter(item=>item.icon_verified &&
    Boolean(item.icon_asset) && item.slot===slot &&
    equipmentAvailableForJob(item,job))
    .sort((a,b)=>
      (a.rarity==="hero"?0:1)-(b.rarity==="hero"?0:1) ||
      b.tier-a.tier || a.item_name.localeCompare(b.item_name,"ko")
    ),[catalog,slot,job]);
  const selectedItem=items.find(item=>item.item_id===itemId) || null;
  const offer=selectedItem ? offered(selectedItem) : "";
  const proposal=useMemo(()=>
    category==="equipment" && selectedItem
      ? recommendEquipment(activeEquipment,slot,offer,{
          candidateJob:job==="전체"?undefined:job,limit:activeEquipment.length,
        }) : null,
  [category,activeEquipment,slot,offer,selectedItem,job]);
  const suggestedGids=new Set((proposal?.suggestions || [])
    .flatMap(s=>s.chain.map(step=>step.gid)));

  const reviewRows=selectedItem && category==="equipment"
    ? selectedMembers.filter(m=>!suggestedGids.has(m.gid)).map(member=>{
      const current=member.slots.find(s=>s.slot===slot);
      const before=current?.item || "";
      const oldTier=getEquipmentTier(before),newTier=getEquipmentTier(offer);
      let reason="현재 장비가 동급 이상";
      if(!before) reason="기존 장비 미기록";
      else if(!newTier || !oldTier)
        reason="장비 등급 확인 불가";
      else if(newTier.group!==oldTier.group)
        reason=newTier.group==="normal" ? "현재 영웅 장비 착용 · 등급 하향 제외" : "등급 비교 확인 필요";
      else if((slot==="무기" || slot==="보조무기") &&
        equipmentKind(offer,slot)!==equipmentKind(before,slot))
        reason="무기 종류·직업 적합성 확인 필요";
      return {member,before,reason,personal:Boolean(current?.personal)};
    }).sort((a,b)=>power(b.member.growthPower)-power(a.member.growthPower)) : [];

  const skills=job==="전체" ? [] : classHeroSkills(job);
  const selectedSkill=skills.find(s=>s.name===skillName) || null;
  const skillRows=useMemo(()=>{
    if(category!=="skill" || !selectedSkill) return [];
    const source:RosterPreviewMember[]=rosterMembers.length ? rosterMembers :
      activeEquipment.map(m=>({gid:m.gid,nickname:m.nickname,job:m.job,
        guild:m.guild,growthPower:m.growthPower}));
    const equipLookup=new Map(members.map(m=>[String(m.gid),m]));
    const records=skillHistory.filter(r=>r.category==="영웅스킬" &&
      normalizeSkillName(r.item)===normalizeSkillName(selectedSkill.name) &&
      (!r.job?.trim() || normalizeSkillJob(r.job)===job));
    return source.filter(m=>normalizeSkillJob(m.job)===job).map(member=>{
      const equipment=equipLookup.get(String(member.gid));
      const aliases=new Set<string>();
      for(const nickname of [member.nickname,equipment?.sourceNickname || ""]){
        if(!nickname) continue;
        aliases.add(clean(nickname));
        for(const part of nickname.split(/[()]/))
          if(part.trim()) aliases.add(clean(part));
      }
      const record=records.filter(r=>aliases.has(clean(r.target)))
        .sort((a,b)=>Number(b.row)-Number(a.row))[0];
      return {member,record};
    }).sort((a,b)=>Number(Boolean(a.record))-Number(Boolean(b.record)) ||
      power(b.member.growthPower)-power(a.member.growthPower) ||
      a.member.nickname.localeCompare(b.member.nickname,"ko"));
  },[category,selectedSkill,job,rosterMembers,activeEquipment,members,skillHistory]);
  const recorded=skillRows.filter(s=>Boolean(s.record)).length;

  async function copySuccessionPlan() {
    if (!selectedItem || !proposal?.suggestions.length) return;
    const plan = proposal.suggestions[0];
    const rows = [
      "[밍보드 장비 분배·연쇄 계승 예상안]",
      "신규 아이템: " + itemLabel(selectedItem),
      "부위 / 직업: " + (labelBySlot[slot] || slot) + " / " + job,
      ...plan.chain.map((step, index) => {
        const member = selectedMembers.find(m => m.gid === step.gid);
        const from = index === 0 ? "신규 획득" : plan.chain[index - 1].nickname + " 회수";
        return (index + 1) + "차 " + step.nickname +
          " (성장력 " + power(member?.growthPower || "").toLocaleString("ko-KR") +
          ") : " + displayEquipmentName(step.before) +
          " → " + displayEquipmentName(step.receives) + " [" + from + "]";
      }),
      "종료: " + plan.reasons[2],
      "※ 참고 미리보기 · 실제 지급/회수와 시트 변경은 운영진 확인 후 별도 처리",
    ];
    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setCopyState("계승 경로를 복사했습니다.");
    } catch {
      setCopyState("복사할 수 없습니다. 브라우저 클립보드 권한을 확인해주세요.");
    }
  }

  function switchCategory(next:"equipment"|"skill") {
    setCategory(next);setItemId("");setSkillName("");setShowAll(false);setCopyState("");
  }
  function switchJob(next:string) {
    setJob(next);setItemId("");setSkillName("");setShowAll(false);setCopyState("");
  }

  return <section className={styles.adminPanel} aria-label="신규 장비 및 스킬북 시뮬레이션">
    <div className={styles.panelTitle}><div>
      <span className={styles.eyebrow}>ADMIN · PREVIEW ONLY</span>
      <h3>신규 장비 분배 · 계승 시뮬레이션</h3>
    </div><span className={styles.profileBadge}>관리자 전용</span></div>
    <p className={styles.muted}>
      실제 분배를 기록하지 않는 미리보기입니다. 개인구매·직업 적합성·참여도와 스킬 습득 여부는 운영진 최종 확인이 필요합니다.
    </p>
    <div className={styles.simFilters}>
      <label>분류
        <select className={styles.select} value={category}
          onChange={e=>switchCategory(e.target.value as "equipment"|"skill")}>
          <option value="equipment">장비</option><option value="skill">스킬북</option>
        </select>
      </label>
      {category==="equipment" && <label>장비 부위
        <select className={styles.select} value={slot}
          onChange={e=>{setSlot(e.target.value);setItemId("");setShowAll(false);}}>
          {EQUIPMENT_SLOTS.map(s=><option key={s} value={s}>{labelBySlot[s]||s}</option>)}
        </select>
      </label>}
      <label>직업
        <select className={styles.select} value={job} onChange={e=>switchJob(e.target.value)}>
          <option value="전체">{category==="equipment"?"전체 직업":"직업 선택"}</option>
          {jobs.map(v=><option value={v} key={v}>{v}</option>)}
        </select>
      </label>
      {category==="equipment" ? <label>아이템
        <select className={styles.select} value={selectedItem?.item_id || ""}
          onChange={e=>{setItemId(e.target.value);setShowAll(false);}}>
          <option value="">아이템 선택 ({items.length}종)</option>
          {items.map(item=><option key={item.item_id} value={item.item_id}>
            {itemLabel(item)}
          </option>)}
        </select>
      </label> : <label>스킬북
        <select className={styles.select} value={selectedSkill?.name||""}
          disabled={job==="전체"}
          onChange={e=>{setSkillName(e.target.value);setShowAll(false);}}>
          <option value="">{job==="전체"?"직업을 먼저 선택":"스킬북 선택"}</option>
          {skills.map(skill=><option value={skill.name} key={skill.name}>
            영웅 스킬 {skill.rank} · {skill.name}
          </option>)}
        </select>
      </label>}
    </div>
    {category==="equipment" ? !selectedItem ? <p className={styles.simPrompt}>
      장비 부위·직업·아이템을 선택하면 추천 및 검토 명단이 바로 표시됩니다.
    </p> : <div className={styles.simResult} aria-live="polite">
      <div className={styles.simSummary}>
        <div><small>선택 아이템</small><strong>{itemLabel(selectedItem)}</strong></div>
        <div><small>장비 조사된 활동 길드원</small><strong>{selectedMembers.length}명</strong></div>
        <div><small>신규 장비 최초 지급</small><strong>{proposal?.suggestions.length || 0}명</strong></div>
        <div><small>후속 장비 계승</small><strong>{proposal?.suggestions[0]?.chain.length ? proposal.suggestions[0].chain.length - 1 : 0}명</strong></div>
      </div>
      <p className={styles.simHint}>
        신규 장비는 1개 기준으로 계산합니다. 해당 직업에서 받을 수 있는 성장력 최상위 인원에게 먼저 지급하며,
        회수 가능한 기존 장비는 같은 직업·길드에서 낮은 장비를 착용한 인원 중 성장력 순으로 계승합니다.
        개인구매 장비와 일반 T4 이하는 후속 계승하지 않습니다.
      </p>

      {(proposal?.suggestions.length || 0)>0 && <div className={styles.simGroup}>
        <div className={styles.simGroupHeader}>
          <h4>신규 장비 최초 지급 <span>1명</span></h4>
          <button type="button" className={styles.simExpand}
            onClick={copySuccessionPlan}>계승 경로 복사</button>
        </div>
        {copyState && <p className={styles.simHint} role="status">{copyState}</p>}
        {proposal?.suggestions.map(row=> {
          const first=selectedMembers.find(m=>m.gid===row.gid);
          const oldTier=getEquipmentTier(row.currentItem);
          const newTier=getEquipmentTier(offer);
          return <div key={row.gid} className={styles.simChainGroup}>
            <article className={`${styles.simRow} ${styles.simRowPrimary}`}>
              <span className={styles.simOrder}>1</span>
              <div className={styles.simIdentity}>
                <strong>{row.nickname}</strong>
                <small>{row.job} · {row.guild} · 성장력 {power(first?.growthPower || "").toLocaleString("ko-KR")}</small>
              </div>
              <div className={styles.simRowDetails}>
                <strong><GradeItem item={row.currentItem} /> <span className={styles.simItemArrow}>→</span> <GradeItem item={offer} /></strong>
                <small>{oldTier?.group !== newTier?.group ? "희귀 → 영웅 등급 상승" : "동일 등급 티어 상승"}</small>
              </div>
            </article>
            <h4 className={styles.simChainHeading}>예상 계승 경로 <span>{row.chain.length-1}명</span></h4>
            {row.chain.slice(1).map((step,index)=>{
              const receiver=selectedMembers.find(m=>m.gid===step.gid);
              const prior=row.chain[index];
              return <article className={styles.simRow} key={step.gid}>
                <span className={styles.simOrder}>{index+2}</span>
                <div className={styles.simIdentity}>
                  <strong>{step.nickname}</strong>
                  <small>{receiver?.job} · {receiver?.guild} · 성장력 {power(receiver?.growthPower || "").toLocaleString("ko-KR")}</small>
                </div>
                <div className={styles.simRowDetails}>
                  <strong><GradeItem item={step.before} /> <span className={styles.simItemArrow}>→</span> <GradeItem item={step.receives} /></strong>
                  <small>{prior.nickname}의 회수 장비 계승 예정 · 운영진 확인 필요</small>
                </div>
              </article>;
            })}
            <p className={styles.simChainStop}>
              {row.chain.length===1 ? "후속 계승 없음 · " : "계승 경로 종료 · "}
              {row.reasons[2]}
            </p>
          </div>;
        })}
      </div>}
      {reviewRows.length>0 && <div className={styles.simGroup}>
        <div className={styles.simGroupHeader}>
          <h4>기타 조사 인원 <span>{reviewRows.length}명 · 신규 지급·계승 미선정</span></h4>
          <button className={styles.simExpand} type="button"
            onClick={()=>setShowAll(v=>!v)}>
            {showAll?"목록 접기":"다른 인원 보기"}
          </button>
        </div>
        {showAll && reviewRows.map(({member,before,reason,personal})=>
          <article className={styles.simRow} key={member.gid}>
            <span className={styles.simOrderMuted}>·</span>
            <div className={styles.simIdentity}><strong>{member.nickname}</strong>
              <small>{member.job} · {member.guild}</small></div>
            <div className={styles.simRowDetails}>
              <strong>{before?<GradeItem item={before} />:"장비 미기록"}</strong>
              <small>{reason}{personal?" · 개인구매":""}</small>
            </div>
          </article>)}
      </div>}
      {!selectedMembers.length && <p className={styles.simPrompt}>해당 직업의 장비 조사 기록이 없습니다.</p>}
    </div> : !selectedSkill ? <p className={styles.simPrompt}>
      직업과 스킬북을 고르면 길드원별 분배 이력과 검토 명단을 바로 볼 수 있습니다.
    </p> : <div className={styles.simResult} aria-live="polite">
      <div className={styles.simSummary}>
        <div><small>선택 스킬북</small><strong>{selectedSkill.name}</strong></div>
        <div><small>해당 직업 활동 길드원</small><strong>{skillRows.length}명</strong></div>
        <div><small>분배 기록 미확인</small><strong>{skillRows.length-recorded}명</strong></div>
        <div><small>분배 기록 확인</small><strong>{recorded}명</strong></div>
      </div>
      <p className={styles.simHint}>
        분배 기록이 없는 인원을 먼저, 같은 그룹에서는 성장력순으로 정렬한 검토 명단입니다.
        이력이 없다고 미습득으로 단정할 수 없고, 이력이 있어도 현재 보유 여부는 별도 확인이 필요합니다.
      </p>
      {skillRows.slice(0,showAll?undefined:18).map(({member,record},i)=>
        <article className={styles.simRow} key={member.gid}>
          <span className={record?styles.simOrderMuted:styles.simOrder}>{i+1}</span>
          <div className={styles.simIdentity}><strong>{member.nickname}</strong>
            <small>{member.job} · {member.guild} · 성장력 {power(member.growthPower).toLocaleString("ko-KR")}</small>
          </div>
          <div className={styles.simRowDetails}>
            <strong>{record?"분배 이력 확인":"분배 이력 미확인 · 검토 필요"}</strong>
            <small>{record?"기록일 "+(record.date||"미상")+" · 원본 행 "+record.row:
              "현재 습득 여부 별도 확인"}</small>
          </div>
        </article>)}
      {skillRows.length>18 && <button type="button" className={styles.simExpand}
        onClick={()=>setShowAll(v=>!v)}>
        {showAll?"목록 접기":"전체 "+skillRows.length+"명 보기"}
      </button>}
      {!skillRows.length && <p className={styles.simPrompt}>해당 직업의 활동 길드원이 없습니다.</p>}
    </div>}
  </section>;
}
