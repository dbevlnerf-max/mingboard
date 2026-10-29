"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./scoped.module.css";

type Member = {
 gid: string; nickname: string; guild: string; job: string;
 growthPower: string; growthPowerNumber: number;
};
export default function ScopedMembersManager({ guild }: { guild: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [nickname, setNickname] = useState("");
  const [job, setJob] = useState("");
  const [power, setPower] = useState("");
  const [leaving, setLeaving] = useState<Member | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/admin/managed-members", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok || !data.success || data.scope !== guild || !Array.isArray(data.members))
        throw new Error(data.message || "관리할 길드 명단을 불러오지 못했습니다.");
      setMembers(data.members);
    } catch (e) { setError(e instanceof Error ? e.message : "길드원 조회 실패"); }
    finally { setLoading(false); }
  }, [guild]);
  useEffect(() => { void reload(); }, [reload]);
  const filtered = useMemo(() =>
    members.filter(m => [m.nickname,m.gid,m.job].some(v =>
      String(v || "").toLocaleLowerCase("ko").includes(search.trim().toLocaleLowerCase("ko"))))
      .sort((a,b)=>Number(b.growthPowerNumber||0)-Number(a.growthPowerNumber||0)),
    [members, search]);
  async function save() {
    if (!editing) return;
    if (!nickname.trim()) { setError("닉네임을 입력해주세요."); return; }
    setBusy(true);setError("");setNotice("");
    try {
      const r = await fetch(`/api/admin/managed-members/${editing.gid}`, {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({job, growthPower:power, nickname:nickname.trim(), guild:editing.guild,
          expectedNickname: editing.nickname}),
      });
      const data=await r.json();
      if(!r.ok || !data.success)throw new Error(data.message||"수정 실패");
      if(!data.sheetSynced || !data.portalSynced)
        throw new Error("원본 시트와 밍보드 저장 결과를 확인할 수 없습니다.");
      setEditing(null);await reload();
      setNotice(data.message || "원본 Google Sheets 및 밍보드에 저장했습니다.");
    } catch(e){setError(e instanceof Error?e.message:"수정 실패");}
    finally{setBusy(false);}
  }
  async function leave() {
    if(!leaving || confirmName.trim()!==leaving.nickname) {
      setError("탈퇴 확인을 위해 닉네임을 정확히 입력해주세요.");return;
    }
    setBusy(true);setError("");
    try {
      const r=await fetch(`/api/admin/managed-members/${leaving.gid}`, {method:"DELETE"});
      const data=await r.json();
      if(!r.ok || !data.success)throw new Error(data.message||"탈퇴 실패");
      if(data.warning) window.alert(data.warning);
      setLeaving(null);setConfirmName("");await reload();
    }catch(e){setError(e instanceof Error?e.message:"탈퇴 실패");}
    finally{setBusy(false);}
  }
  return <main className={styles.root}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div><small>GUILD MEMBER · LIMITED ACCESS</small>
          <h1>{guild} 길드원 관리</h1>
          <p>담당 길드의 닉네임·전투력·직업 수정 및 탈퇴 처리만 가능합니다.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={reload} disabled={loading}>↻ 새로고침</button>
          <Link href="/admin">← 관리자 홈</Link>
        </div>
      </header>
      <section className={styles.stats}>
        <div><small>관리 가능한 인원</small><strong>{members.length}명</strong></div>
        <div><small>권한 범위</small><strong>{guild} 전용</strong></div>
        <div><small>수정 가능한 항목</small><strong>닉네임 · 전투력 · 직업 · 탈퇴</strong></div>
      </section>
      <div className={styles.toolbar}><input aria-label="길드원 검색" value={search}
        onChange={e=>setSearch(e.target.value)} placeholder="닉네임 · GID · 직업 검색" />
        <span>{filtered.length}명 표시</span>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {notice && <p className={styles.success} role="status">{notice}</p>}
      {loading ? <p className={styles.empty}>길드원 명단을 불러오는 중입니다.</p> :
        <div className={styles.list}>
          {filtered.map(m=><article key={m.gid} className={styles.row}>
            <span className={styles.gid}>GID {m.gid}</span>
            <strong>{m.nickname}</strong><span>{m.job||"직업 미입력"}</span>
            <b>{Number(String(m.growthPower).replace(/,/g,"")).toLocaleString("ko-KR")}</b>
            <div className={styles.rowActions}>
              <button type="button" onClick={()=>{setEditing(m);setNickname(m.nickname);setJob(m.job||"");setPower(String(m.growthPowerNumber||m.growthPower).replace(/,/g,""));setError("");}}>수정</button>
              <button type="button" className={styles.danger} onClick={()=>{setLeaving(m);setConfirmName("");setError("");}}>탈퇴</button>
            </div>
          </article>)}
          {!filtered.length&&<p className={styles.empty}>해당 길드원이 없습니다.</p>}
        </div>}
      {editing&&<div className={styles.overlay} role="dialog" aria-modal="true" aria-label="길드원 수정">
        <div className={styles.modal}><h2>{editing.nickname} 정보 수정</h2>
          <p>GID {editing.gid} · {editing.guild} · GID와 소속 길드는 변경할 수 없습니다.</p>
          <label>닉네임<input value={nickname} onChange={e=>setNickname(e.target.value)}
            maxLength={24} autoComplete="off" /></label>
          <label>직업<input value={job} onChange={e=>setJob(e.target.value)} maxLength={40}/></label>
          <label>전투력<input type="text" inputMode="numeric" value={power} onChange={e=>setPower(e.target.value)}/></label>
          <div className={styles.modalActions}>
            <button type="button" onClick={()=>setEditing(null)} disabled={busy}>취소</button>
            <button type="button" onClick={save} disabled={busy}>{busy?"저장 중":"변경 저장"}</button>
          </div>
        </div>
      </div>}
      {leaving&&<div className={styles.overlay} role="dialog" aria-modal="true" aria-label="길드원 탈퇴">
        <div className={styles.modal}><h2>길드원 탈퇴 처리</h2>
          <p>{leaving.nickname} · {leaving.guild} · GID {leaving.gid}</p>
          <p>활동 명단에서 제외하지만 과거 분배·참여 기록은 보존합니다.</p>
          <label>확인을 위해 닉네임 입력
            <input value={confirmName} onChange={e=>setConfirmName(e.target.value)}
              placeholder={leaving.nickname}/>
          </label>
          <div className={styles.modalActions}>
            <button type="button" onClick={()=>setLeaving(null)} disabled={busy}>취소</button>
            <button type="button" className={styles.danger} onClick={leave}
              disabled={busy||confirmName.trim()!==leaving.nickname}>탈퇴 처리</button>
          </div>
        </div>
      </div>}
    </div>
  </main>;
}
