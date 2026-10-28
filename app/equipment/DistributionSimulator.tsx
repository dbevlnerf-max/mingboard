"use client";
import { useMemo, useState } from "react";
import {
  EQUIPMENT_SLOTS, getEquipmentTier, equipmentKind, recommendEquipment,
  type EquippedMember,
} from "@/lib/equipment-recommendation";
import { classHeroSkills, normalizeSkillJob, normalizeSkillName } from "@/lib/skill-catalog";
import { displayEquipmentName, type EquipmentCatalogItem } from "@/lib/equipment-catalog";
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

export default function DistributionSimulator({members,rosterMembers,catalog,skillHistory}:Props) {
  const [category,setCategory]=useState<"equipment"|"skill">("equipment");
  const [slot,setSlot]=useState<string>("무기");
  const [job,setJob]=useState("전체");
  const [itemId,setItemId]=useState("");
  const [skillName,setSkillName]=useState("");
  const [showAll,setShowAll]=useState(false);

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
    (!item.job_class || job==="전체" || normalizeSkillJob(item.job_class)===job))
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
  const suggestedGids=new Set((proposal?.suggestions || []).map(s=>s.gid));

  const reviewRows=selectedItem && category==="equipment"
    ? selectedMembers.filter(m=>!suggestedGids.has(m.gid)).map(member=>{
      const current=member.slots.find(s=>s.slot===slot);
      const before=current?.item || "";
      const oldTier=getEquipmentTier(before),newTier=getEquipmentTier(offer);
      let reason="현재 장비가 동급 이상";
      if(!before) reason="기존 장비 미기록";
      else if(!newTier || !oldTier || newTier.group!==oldTier.group)
        reason="등급 체계가 달라 자동 비교 불가";
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

  function switchCategory(next:"equipment"|"skill") {
    setCategory(next);setItemId("");setSkillName("");setShowAll(false);
  }
  function switchJob(next:string) {
    setJob(next);setItemId("");setSkillName("");setShowAll(false);
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
        <div><small>자동 교체 추천</small><strong>{proposal?.suggestions.length || 0}명</strong></div>
        <div><small>추가 확인 대상</small><strong>{reviewRows.length}명</strong></div>
      </div>
      <p className={styles.simHint}>
        추천은 같은 등급 체계·장비 종류에서 티어가 상승하는 경우에만 표시합니다.
        타 등급·다른 종류·미기록 장비는 자동 판단 없이 추가 검토로 표시합니다.
      </p>
      {(proposal?.suggestions.length || 0)>0 && <div className={styles.simGroup}>
        <h4>자동 교체 추천 <span>{proposal?.suggestions.length}명</span></h4>
        {proposal?.suggestions.map((row,i)=>{
          const member=selectedMembers.find(m=>m.gid===row.gid);
          const worn=member?.slots.find(s=>s.slot===slot);
          return <article className={styles.simRow} key={row.gid}>
            <span className={styles.simOrder}>{i+1}</span>
            <div className={styles.simIdentity}><strong>{row.nickname}</strong>
              <small>{row.job} · {row.guild}</small></div>
            <div className={styles.simRowDetails}>
              <strong>{displayEquipmentName(row.currentItem)} → {selectedItem.item_name}</strong>
              <small>티어 +{row.gainedTiers} · {worn?.personal?"기존 장비 개인구매(계승 제외)":
                row.chain.length>1?"후속 계승 검토: "+row.chain[1].nickname:
                "후속 계승 대상 미확정"}</small>
            </div>
          </article>;
        })}
      </div>}
      {reviewRows.length>0 && <div className={styles.simGroup}>
        <div className={styles.simGroupHeader}><h4>추가 확인 대상 <span>{reviewRows.length}명</span></h4>
          {reviewRows.length>8 && <button className={styles.simExpand} type="button"
            onClick={()=>setShowAll(v=>!v)}>
            {showAll?"접기":"전체 "+reviewRows.length+"명 보기"}
          </button>}
        </div>
        {reviewRows.slice(0,showAll?undefined:8).map(({member,before,reason,personal})=>
          <article className={styles.simRow} key={member.gid}>
            <span className={styles.simOrderMuted}>·</span>
            <div className={styles.simIdentity}><strong>{member.nickname}</strong>
              <small>{member.job} · {member.guild}</small></div>
            <div className={styles.simRowDetails}>
              <strong>{before?displayEquipmentName(before):"장비 미기록"}</strong>
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
