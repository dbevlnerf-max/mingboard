"use client";
import { useState } from "react";

type Result = { guild: string; role: string; roleId?: string;
 assigned: string[]; pending: string[]; errors: string[] };
export default function GuildRoleSetup() {
  const [loading,setLoading]=useState(false);
  const [results,setResults]=useState<Result[]>([]);
  const [error,setError]=useState("");
  async function setup() {
    if (!window.confirm("Discord에 길드 담당자 역할 3개를 생성/확인하고 연결된 담당자에게 지급할까요?\n\n기존 전체 관리자 권한은 부여하지 않습니다.")) return;
    setLoading(true);setError("");
    try {
      const r=await fetch("/api/admin/guild-manager-roles",{method:"POST"});
      const result=await r.json();
      if(!r.ok||!result.success)throw new Error(result.message||"Discord 설정 실패");
      setResults(result.results||[]);
    } catch(e){setError(e instanceof Error?e.message:"역할 생성 실패");}
    finally {setLoading(false);}
  }
  return <section style={{marginTop:22,padding:22,background:"#101010",border:"1px solid #343434",borderRadius:12}}>
    <small style={{color:"#d4ad77",letterSpacing:2}}>MASTER · DISCORD ROLE SETUP</small>
    <h2 style={{fontSize:20,margin:"12px 0"}}>길드별 담당자 역할 연결</h2>
    <p style={{color:"#aaa",fontSize:12,lineHeight:1.8}}>
      천제_관리자: 왕알 · 엔짱 / 지소_관리자: 은연우 · 채린 / 아스_관리자: 조범랑 · 티탄<br/>
      이 역할은 Discord의 서버 관리 권한을 포함하지 않으며, 밍보드에서는 담당 길드의
      전투력·직업 수정 및 탈퇴 처리만 허용합니다.
    </p>
    <button type="button" disabled={loading} onClick={setup}
      style={{background:"#d2ad7c",color:"#241b13",border:0,borderRadius:8,
        padding:"11px 17px",fontWeight:800,cursor:"pointer"}}>
      {loading?"Discord 역할 설정 중…":"Discord 역할 생성·담당자 지급"}
    </button>
    {error&&<p role="alert" style={{color:"#f0a8a8"}}>{error}</p>}
    {results.length>0 && <div style={{display:"grid",gap:10,marginTop:16}}>
      {results.map(row=><article key={row.guild}
        style={{padding:13,border:"1px solid #383838",borderRadius:8}}>
        <strong>{row.role} · {row.guild}</strong>
        <p style={{fontSize:12,color:"#b8caa9"}}>지급 완료: {row.assigned.join(", ")||"없음"}</p>
        {!!row.pending.length&&<p style={{color:"#d6b47c",fontSize:12}}>대기: {row.pending.join(" / ")}</p>}
        {!!row.errors.length&&<p style={{color:"#e69d9d",fontSize:12}}>실패: {row.errors.join(" / ")}</p>}
      </article>)}
    </div>}
  </section>;
}
