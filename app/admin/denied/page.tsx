import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminDeniedPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  return (
    <main style={{minHeight:"80vh",display:"grid",placeItems:"center",padding:"30px 18px",background:"#090909",color:"#f2f0ee"}}>
      <section style={{maxWidth:540,width:"100%",background:"#151515",border:"1px solid #34302b",borderRadius:14,padding:"32px 28px"}}>
        <small style={{color:"#bc9a6e",letterSpacing:2,fontWeight:800}}>ACCESS DENIED</small>
        <h1 style={{fontSize:24,margin:"14px 0"}}>접근 권한이 없습니다</h1>
        <p style={{fontSize:13,lineHeight:1.9,color:"#beb7ae"}}>
          관리자 메뉴는 전체 운영 항목을 보여주지만, 계정별 권한을 서버에서 확인합니다.
          길드별 운영진은 자기 길드의 길드원 관리, 장비 분배·계승 관리,
          탈퇴 인원 조회에만 접근할 수 있습니다.
        </p>
        <Link href="/admin" style={{display:"inline-block",background:"#c6a77d",color:"#201a14",fontWeight:800,padding:"11px 18px",borderRadius:8,textDecoration:"none",marginTop:15}}>
          관리자 홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
