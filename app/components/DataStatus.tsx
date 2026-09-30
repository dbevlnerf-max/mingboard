"use client";

type Props = {
  refreshing: boolean;
  error: string;
  retrying: boolean;
  offline: boolean;
  updatedAt?: number;
  sourceUpdatedAt?: number;
  stale?: boolean;
  refresh: () => void;
};

export default function DataStatus(props: Props) {
  const { refreshing, error, retrying, offline, updatedAt, sourceUpdatedAt, stale, refresh } = props;
  const lastConfirmedAt = sourceUpdatedAt ?? updatedAt;
  const message = offline
    ? "연결이 돌아오면 자동으로 갱신합니다."
    : error
      ? retrying ? "연결이 늦어져 다시 확인하고 있어요." : error
      : refreshing ? "최신 내용을 확인하고 있어요."
        : stale ? "저장된 내용을 표시하고 최신 값을 확인하고 있어요." : "최신 내용 확인 완료";
  return (
    <div className="portalDataStatus" data-state={offline || error || stale ? "waiting" : "ready"}>
      <div role="status" aria-live="polite">
        <span className="portalStatusDot" aria-hidden="true" />
        <span>{message}</span>
        {lastConfirmedAt && Number.isFinite(lastConfirmedAt) && (
          <small>
            마지막 확인 {new Date(lastConfirmedAt).toLocaleTimeString("ko-KR", {
              timeZone: "Asia/Seoul", hour12: false,
            })}{(error || offline || stale) && " · 이전 조회 결과 표시 중"}
          </small>
        )}
      </div>
      <button type="button" onClick={refresh} disabled={refreshing || offline}>
        {refreshing ? "확인 중" : "다시 확인"}
      </button>
    </div>
  );
}
