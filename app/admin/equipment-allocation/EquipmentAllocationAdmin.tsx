"use client";

import Link from "next/link";
import { useMemo } from "react";
import DataStatus from "@/app/components/DataStatus";
import { usePortalQuery } from "@/lib/use-portal-query";
import type { EquippedMember } from "@/lib/equipment-recommendation";
import type { EquipmentCatalogItem } from "@/lib/equipment-catalog";
import DistributionSimulator, {
  type RosterPreviewMember,
} from "@/app/equipment/DistributionSimulator";
import equipmentStyles from "@/app/equipment/equipment.module.css";
import styles from "./allocation.module.css";

type History = {
  row: number; date: string; item: string; category: string;
  job: string; target: string; diamond: string; notes: string;
};

type EquipmentResponse = {
  success: boolean;
  message?: string;
  members?: EquippedMember[];
  catalog?: EquipmentCatalogItem[];
  rosterMembers?: RosterPreviewMember[];
  skillHistory?: History[];
  history?: History[];
  updatedAt?: string | null;
  rosterTotal?: number;
};

export default function EquipmentAllocationAdmin() {
  const query = usePortalQuery<EquipmentResponse>(
    "/api/equipment", { arrayField: "members" }
  );
  const members = useMemo(() => query.data?.members ?? [], [query.data?.members]);
  const catalog = useMemo(() => query.data?.catalog ?? [], [query.data?.catalog]);
  const skillHistory = useMemo(
    () => query.data?.skillHistory ?? [], [query.data?.skillHistory]
  );
  const rosterMembers = useMemo(
    () => query.data?.rosterMembers ?? [], [query.data?.rosterMembers]
  );
  const staleHours = query.data?.updatedAt
    ? (Date.now() - new Date(query.data.updatedAt).getTime()) / 3_600_000
    : null;

  return (
    <main className={equipmentStyles.root}>
      <div className={equipmentStyles.shell}>
        <div className={styles.navigation}>
          <Link href="/admin">← 관리자 홈</Link>
          <Link href="/equipment">길드원 착용장비 보기</Link>
        </div>
        <header className={equipmentStyles.heading}>
          <div>
            <span className={equipmentStyles.eyebrow}>ADMIN · EQUIPMENT ALLOCATION</span>
            <h1>장비 분배·연쇄 계승 관리</h1>
            <p>새 장비 1개를 기준으로 성장력 최상위 지급자 1명과 후속 계승 순서를 계산합니다.</p>
          </div>
          <button type="button" className={equipmentStyles.outline}
            disabled={query.loading || query.refreshing}
            onClick={() => query.refresh()}>
            ↻ 데이터 다시 확인
          </button>
        </header>
        <DataStatus {...query} />
        <div className={styles.stats}>
          <div>
            <span>장비 조사 인원</span>
            <strong>{members.length}명</strong>
          </div>
          <div>
            <span>전체 활동 길드원</span>
            <strong>{query.data?.rosterTotal ?? "—"}명</strong>
          </div>
          <div>
            <span>현재 장비 스냅샷</span>
            <strong>{query.data?.updatedAt
              ? new Date(query.data.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
              : "미확인"}</strong>
          </div>
        </div>
        {staleHours !== null && staleHours > 1 && (
          <div className={styles.notice} role="status">
            현재 착용장비 자료가 {Math.floor(staleHours)}시간 이상 전에 수집됐습니다.
            실제 지급 전에 Google Sheet의 최신 장비를 반드시 확인하세요.
          </div>
        )}
        <div className={styles.noticeMuted}>
          <strong>사용 순서</strong>
          <span>장비부위 → 직업 → 신규 아이템 선택 → 최초 지급자와 단계별 계승 경로 확인</span>
          <span>개인구매 및 일반 T4 이하 장비는 회수·재계승에서 제외됩니다.</span>
        </div>
        {query.error && !query.data && (
          <p className={styles.error}>{query.error}</p>
        )}
        {query.loading && !query.data && (
          <div className={styles.loading}>장비 현황과 분배 이력을 불러오는 중입니다.</div>
        )}
        {query.data && (
          <DistributionSimulator
            members={members}
            rosterMembers={rosterMembers}
            catalog={catalog}
            skillHistory={skillHistory}
          />
        )}
        <div className={styles.footer}>
          <p>
            이 기능은 분배·계승 계획 미리보기입니다. 지급 확정 및 착용장비 변경은
            원본 구글시트에서 실제 수령과 회수를 확인한 후 진행해야 합니다.
            계획 조회만으로 원본 장비와 지급 이력은 바뀌지 않습니다.
          </p>
          <a href="https://docs.google.com/spreadsheets/d/1M_OwSYyJeXD0PKqToTf1SJ_BMGFmTII2zKYv1JtSThg/edit#gid=1520261028"
            target="_blank" rel="noopener noreferrer">
            장비 변경이력 시트 열기 ↗
          </a>
        </div>
      </div>
    </main>
  );
}
