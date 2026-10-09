"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  signOut,
  useSession,
} from "next-auth/react";

import AppTopBar from "@/app/components/AppTopBar";
import DataStatus from "@/app/components/DataStatus";
import { usePortalQuery } from "@/lib/use-portal-query";


type DistributionRow = {
  rowNumber: number;
  date: string;
  dateKey: string;
  item: string;
  category: string;
  itemJob: string;
  target: string;
  diamond: number;
  member: {
    gid: string;
    nickname: string;
    job: string;
    growthPower: string;
    guild: string;
  } | null;
};


type DistributionResponse = {
  success: boolean;
  message?: string;

  query?: {
    startDate: string;
    endDate: string;
    category: string;
    sort: "latest" | "oldest";
    page: number;
    pageSize: number;
  };

  totalCount?: number;
  filteredCount?: number;
  filteredDiamond?: number;
  totalPages?: number;
  categories?: string[];
  rows?: DistributionRow[];
};


function localDateKey(
  value:
    Date
) {

  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() +
      1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      value.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;
}


function shiftDate(
  value:
    Date,
  days:
    number
) {

  const next =
    new Date(
      value
    );

  next.setDate(
    next.getDate() +
    days
  );

  return next;
}


function formatGrowth(
  value:
    string
) {

  const parsed =
    Number(
      String(
        value ||
        ""
      )
        .replace(
          /,/g,
          ""
        )
        .trim()
    );


  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <=
      0
  ) {
    return (
      value ||
      "-"
    );
  }


  return parsed
    .toLocaleString(
      "ko-KR"
    );
}


export default function DistributionPage() {

  const {
    data:
      session,
    status,
  } =
    useSession();


  const initialToday =
    useMemo(
      () =>
        localDateKey(
          new Date()
        ),
      []
    );


  const [
    startDate,
    setStartDate,
  ] =
    useState(
      initialToday
    );


  const [
    endDate,
    setEndDate,
  ] =
    useState(
      initialToday
    );

  const [rangeMode, setRangeMode] = useState<"today" | "yesterday" | "week" | "custom" | "all">("today");
  const [pageSize, setPageSize] = useState(20);


  const [
    category,
    setCategory,
  ] =
    useState(
      "전체"
    );


  const [
    sort,
    setSort,
  ] =
    useState<
      "latest" |
      "oldest"
    >(
      "latest"
    );


  const [
    page,
    setPage,
  ] =
    useState(
      1
    );


  const canRead = status === "authenticated" && Boolean(
    (session?.user?.isGuildMember && session.user.hasZeusRole) ||
    session?.user?.isAdmin || session?.user?.isMaster
  );
  const params = new URLSearchParams({
    category, sort, page: String(page), pageSize: String(pageSize),
  });
  if (rangeMode === "all") {
    params.set("mode", "all");
  } else {
    params.set("startDate", startDate);
    params.set("endDate", endDate);
  }
  const distributionQuery = usePortalQuery<DistributionResponse>(
    canRead ? `/api/distribution?${params.toString()}` : null,
    { arrayField: "rows" },
  );
  const data = distributionQuery.data;
  const categories = data?.categories ?? [];
  const rows = data?.rows ?? [];
  const totalCount = Number(data?.totalCount ?? 0);
  const filteredCount = Number(data?.filteredCount ?? 0);
  const filteredDiamond = Number(data?.filteredDiamond ?? 0);
  const totalPages = Math.max(1, Number(data?.totalPages ?? 1));
  const displayPage = data?.query?.page ?? page;
  const loading = distributionQuery.loading || distributionQuery.refreshing;
  const error = data ? "" : distributionQuery.error;

  function setPresetToday() {
    setRangeMode("today");

    const today =
      localDateKey(
        new Date()
      );

    setPage(1);
    setStartDate(
      today
    );

    setEndDate(
      today
    );
  }


  function setPresetYesterday() {
    setRangeMode("yesterday");

    const yesterday =
      localDateKey(
        shiftDate(
          new Date(),
          -1
        )
      );

    setPage(1);
    setStartDate(
      yesterday
    );

    setEndDate(
      yesterday
    );
  }


  function setPresetSevenDays() {
    setRangeMode("week");

    const today =
      new Date();

    setPage(1);
    setStartDate(
      localDateKey(
        shiftDate(
          today,
          -6
        )
      )
    );

    setEndDate(
      localDateKey(
        today
      )
    );
  }


  if (
    status ===
    "loading"
  ) {

    return (
      <main className="loginStatusPage">
        <div className="loginStatusCard">
          <div className="loadingDot" />

          <strong>
            인증 상태를 확인하고 있습니다.
          </strong>
        </div>
      </main>
    );
  }


  if (
    !session
  ) {

    return (
      <main className="loginStatusPage">
        <div className="accessDeniedCard">
          <div className="accessDeniedIcon">
            🔒
          </div>

          <h2>
            로그인이 필요합니다.
          </h2>

          <p>
            밍보드에 로그인한 뒤 이용할 수 있습니다.
          </p>
        </div>
      </main>
    );
  }


  const canAccess =
    Boolean(
      (
        session.user
          .isGuildMember &&
        session.user
          .hasZeusRole
      ) ||
      session.user
        .isAdmin ||
      session.user
        .isMaster
    );


  if (session.user.authVerificationPending) {
    return (
      <main className="loginStatusPage">
        <div className="loginStatusCard" role="status">
          인증 서버 연결을 다시 확인하고 있습니다. 잠시만 기다려주세요.
        </div>
      </main>
    );
  }

  if (
    !canAccess
  ) {

    return (
      <main className="loginStatusPage">
        <div className="accessDeniedCard">
          <div className="accessDeniedIcon">
            🛡️
          </div>

          <h2>
            분배조회 권한이 없습니다.
          </h2>

          <p>
            게임하는밍쨩 Discord 서버의 제우스 역할 인증이 필요합니다.
          </p>

          <button
            type="button"
            onClick={
              () =>
                signOut()
            }
          >
            로그아웃
          </button>
        </div>
      </main>
    );
  }


  return (
    <main className="distributionPage">
      <AppTopBar />

      <section className="distributionPageShell">

        <div className="distributionPageHero">

          <div>
            <div className="distributionPageKicker">
              GUILD DISTRIBUTION
            </div>

            <h1>
              💎 길드 전체 분배조회
            </h1>

            <p>
              Google Sheet <strong>🪙분배내역</strong>을 기준으로 조회합니다.
              기본 조회기간은 오늘이며, 전체를 누르면 모든 기간을 조회할 수 있습니다.
            </p>
          </div>


          <button
            type="button"
            className="distributionRefreshButton"
            disabled={
              loading
            }
            onClick={
              () =>
                distributionQuery.refresh()
            }
          >
            ↻ 새로고침
          </button>

        </div>


        <DataStatus {...distributionQuery} />

        <div className="distributionSummaryGrid" aria-busy={loading}>

          <div className="distributionSummaryCard">
            <span>
              {rangeMode === "all" ? "전체 기간 분배건수" : "선택기간 분배건수"}
            </span>

            <strong>
              {
                (data ? filteredCount.toLocaleString("ko-KR") : "—")
              }
              건
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              {rangeMode === "all" ? "전체 기간 다이아" : "선택기간 다이아"}
            </span>

            <strong>
              💎{" "}
              {
                (data ? filteredDiamond.toLocaleString("ko-KR") : "—")
              }
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              전체 누적 분배건수
            </span>

            <strong>
              {
                (data ? totalCount.toLocaleString("ko-KR") : "—")
              }
              건
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              현재 페이지
            </span>

            <strong>
              {displayPage} / {totalPages}
            </strong>
          </div>

        </div>


        <section className="distributionFilterCard">

          <div className="distributionQuickRange" role="group" aria-label="분배내역 조회기간">
            <button type="button" className={rangeMode === "today" ? "active" : ""}
              aria-pressed={rangeMode === "today"} onClick={setPresetToday}>오늘</button>
            <button type="button" className={rangeMode === "yesterday" ? "active" : ""}
              aria-pressed={rangeMode === "yesterday"} onClick={setPresetYesterday}>어제</button>
            <button type="button" className={rangeMode === "week" ? "active" : ""}
              aria-pressed={rangeMode === "week"} onClick={setPresetSevenDays}>최근 7일</button>
            <button type="button" className={rangeMode === "all" ? "active allTime" : "allTime"}
              aria-pressed={rangeMode === "all"} onClick={() => { setRangeMode("all"); setPage(1); }}>
              <span aria-hidden="true">∞</span> 전체
            </button>
          </div>
          {rangeMode === "all" && (
            <p className="distributionAllTimeHint" role="status">
              전체 기간의 분배 기록을 조회합니다. 기록이 많아도 페이지를 넘겨 모두 확인할 수 있습니다.
            </p>
          )}>


          <div className="distributionFilterGrid">

            <label>
              <span>
                시작일
              </span>

              <input
                type="date"
                value={rangeMode === "all" ? "" : startDate}
                disabled={rangeMode === "all"}
                onChange={event => {
                  setRangeMode("custom");
                  setPage(1);
                  setStartDate(event.target.value);
                }}
              />
            </label>


            <label>
              <span>
                종료일
              </span>

              <input
                type="date"
                value={rangeMode === "all" ? "" : endDate}
                disabled={rangeMode === "all"}
                onChange={event => {
                  setRangeMode("custom");
                  setPage(1);
                  setEndDate(event.target.value);
                }}
              />
            </label>


            <label>
              <span>
                분류
              </span>

              <select
                value={
                  category
                }
                onChange={
                  event => {
                    setPage(1);
                    setCategory(event.target.value);
                  }
                }
              >
                <option value="전체">
                  전체
                </option>

                {category !== "전체" && !categories.includes(category) && (
                  <option value={category}>{category}</option>
                )}

                {
                  categories
                    .filter(
                      item =>
                        item !==
                        "전체"
                    )
                    .map(
                      item => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )
                }
              </select>
            </label>


            <label>
              <span>
                정렬
              </span>

              <select
                value={
                  sort
                }
                onChange={
                  event => {
                    setPage(1);
                    setSort(event.target.value as "latest" | "oldest");
                  }
                }
              >
                <option value="latest">
                  최신순
                </option>

                <option value="oldest">
                  오래된순
                </option>
              </select>
            </label>

          </div>
          <div className="distributionPageSizeControl">
            <label htmlFor="distribution-page-size">한 페이지 표시</label>
            <select id="distribution-page-size" value={pageSize} onChange={event => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}>
              <option value={20}>20건</option>
              <option value={50}>50건</option>
              <option value={100}>100건</option>
            </select>
          </div>

        </section>


        <section className="distributionResultsCard">

          <div className="distributionResultsHeader">

            <div>
              <h2>
                분배내역
              </h2>

              <span>
                {rangeMode === "all" ? "전체 기간 · 모든 분배 기록" : `${startDate} ~ ${endDate}`}
              </span>
            </div>


            <div className="distributionResultsCount">
              {
                !data
                  ? "조회 중..."
                  : `${filteredCount.toLocaleString("ko-KR")}건`
              }
            </div>

          </div>


          {
            error &&
            (
              <div className="distributionStateError">
                {error}
              </div>
            )
          }


          {
            !data && !error &&
            loading &&
            rows.length ===
              0 &&
            (
              <div className="distributionState">
                분배내역을 불러오고 있습니다.
              </div>
            )
          }


          {
            !error &&
            data &&
            rows.length ===
              0 &&
            (
              <div className="distributionState">
                선택한 조건의 분배내역이 없습니다.
              </div>
            )
          }


          {
            rows.length >
              0 &&
            (
              <>
                <div className="distributionDesktopTableWrap">
                  <table className="distributionDesktopTable">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>아이템</th>
                        <th>분류</th>
                        <th>아이템 직업</th>
                        <th>분배대상</th>
                        <th>현재 길드원 정보</th>
                        <th>다이아</th>
                      </tr>
                    </thead>

                    <tbody>
                      {
                        rows.map(
                          row => (
                            <tr
                              key={
                                row.rowNumber
                              }
                            >
                              <td>
                                {row.date || "-"}
                              </td>

                              <td className="distributionItemCell">
                                {row.item || "-"}
                              </td>

                              <td>
                                <span className="distributionCategoryBadge">
                                  {row.category || "미분류"}
                                </span>
                              </td>

                              <td>
                                {row.itemJob || "-"}
                              </td>

                              <td>
                                <strong>
                                  {row.target || "-"}
                                </strong>
                              </td>

                              <td>
                                {
                                  row.member
                                    ? (
                                      <div className="distributionMemberInfo">
                                        <strong>
                                          {row.member.job || "-"}
                                        </strong>

                                        <span>
                                          {row.member.guild || "-"}
                                          {" · "}
                                          성장력{" "}
                                          {formatGrowth(row.member.growthPower)}
                                        </span>
                                      </div>
                                    )
                                    : (
                                      <span className="distributionMemberMissing">
                                        현재 길드원 정보 없음
                                      </span>
                                    )
                                }
                              </td>

                              <td className="distributionDiamondCell">
                                💎{" "}
                                {
                                  Number(
                                    row.diamond ||
                                    0
                                  )
                                    .toLocaleString(
                                      "ko-KR"
                                    )
                                }
                              </td>
                            </tr>
                          )
                        )
                      }
                    </tbody>
                  </table>
                </div>


                <div className="distributionMobileList">
                  {
                    rows.map(
                      row => (
                        <article
                          className="distributionMobileCard"
                          key={
                            row.rowNumber
                          }
                        >
                          <div className="distributionMobileTop">
                            <span>
                              {row.date || "-"}
                            </span>

                            <strong>
                              💎{" "}
                              {
                                Number(
                                  row.diamond ||
                                  0
                                )
                                  .toLocaleString(
                                    "ko-KR"
                                  )
                              }
                            </strong>
                          </div>


                          <h3>
                            {row.item || "-"}
                          </h3>


                          <div className="distributionMobileBadges">
                            <span>
                              {row.category || "미분류"}
                            </span>

                            {
                              row.itemJob &&
                              (
                                <span>
                                  {row.itemJob}
                                </span>
                              )
                            }
                          </div>


                          <div className="distributionMobileTarget">
                            <span>
                              분배대상
                            </span>

                            <strong>
                              {row.target || "-"}
                            </strong>
                          </div>


                          {
                            row.member &&
                            (
                              <div className="distributionMobileMember">
                                <span>
                                  현재 길드원 정보
                                </span>

                                <strong>
                                  {row.member.job || "-"}
                                </strong>

                                <small>
                                  {row.member.guild || "-"}
                                  {" · "}
                                  성장력{" "}
                                  {formatGrowth(row.member.growthPower)}
                                </small>
                              </div>
                            )
                          }
                        </article>
                      )
                    )
                  }
                </div>
              </>
            )
          }


          <div className="distributionPagination">

            <button
              type="button"
              disabled={
                loading ||
                displayPage <=
                  1
              }
              onClick={
                () =>
                  setPage(Math.max(1, displayPage - 1))
              }
            >
              ← 이전
            </button>


            <span>
              {displayPage} / {totalPages}
            </span>


            <button
              type="button"
              disabled={
                loading ||
                displayPage >=
                  totalPages
              }
              onClick={
                () =>
                  setPage(Math.min(totalPages, displayPage + 1))
              }
            >
              다음 →
            </button>

          </div>

        </section>

      </section>
    </main>
  );
}
