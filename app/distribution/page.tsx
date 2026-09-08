"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  signOut,
  useSession,
} from "next-auth/react";

import AppTopBar from "@/app/components/AppTopBar";


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


  const [
    categories,
    setCategories,
  ] =
    useState<string[]>(
      []
    );


  const [
    rows,
    setRows,
  ] =
    useState<DistributionRow[]>(
      []
    );


  const [
    totalCount,
    setTotalCount,
  ] =
    useState(
      0
    );


  const [
    filteredCount,
    setFilteredCount,
  ] =
    useState(
      0
    );


  const [
    filteredDiamond,
    setFilteredDiamond,
  ] =
    useState(
      0
    );


  const [
    totalPages,
    setTotalPages,
  ] =
    useState(
      1
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    refreshKey,
    setRefreshKey,
  ] =
    useState(
      0
    );


  useEffect(
    () => {

      setPage(
        1
      );

    },
    [
      startDate,
      endDate,
      category,
      sort,
    ]
  );


  useEffect(
    () => {

      if (
        status !==
        "authenticated"
      ) {
        return;
      }


      if (
        !session?.user
      ) {
        return;
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


      if (
        !canAccess
      ) {
        return;
      }


      let disposed =
        false;


      async function loadDistribution() {

        setLoading(
          true
        );

        setError(
          ""
        );


        try {

          const params =
            new URLSearchParams({
              startDate,
              endDate,
              category,
              sort,
              page:
                String(
                  page
                ),
              pageSize:
                "20",
            });


          const response =
            await fetch(
              `/api/distribution?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );


          const data =
            await response
              .json() as
              DistributionResponse;


          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
              "분배내역을 불러오지 못했습니다."
            );
          }


          if (
            disposed
          ) {
            return;
          }


          setRows(
            Array.isArray(
              data.rows
            )
              ? data.rows
              : []
          );


          setCategories(
            Array.isArray(
              data.categories
            )
              ? data.categories
              : []
          );


          setTotalCount(
            Number(
              data.totalCount ||
              0
            )
          );


          setFilteredCount(
            Number(
              data.filteredCount ||
              0
            )
          );


          setFilteredDiamond(
            Number(
              data.filteredDiamond ||
              0
            )
          );


          setTotalPages(
            Math.max(
              1,
              Number(
                data.totalPages ||
                1
              )
            )
          );


          if (
            data.query?.page &&
            data.query.page !==
              page
          ) {
            setPage(
              data.query.page
            );
          }


        } catch (
          loadError
        ) {

          if (
            disposed
          ) {
            return;
          }


          console.error(
            "[길드 전체 분배조회]",
            loadError
          );


          setRows(
            []
          );


          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "분배내역을 불러오지 못했습니다."
          );

        } finally {

          if (
            !disposed
          ) {
            setLoading(
              false
            );
          }
        }
      }


      loadDistribution();


      return () => {
        disposed =
          true;
      };

    },
    [
      status,
      session?.user,
      startDate,
      endDate,
      category,
      sort,
      page,
      refreshKey,
    ]
  );


  function setPresetToday() {

    const today =
      localDateKey(
        new Date()
      );

    setStartDate(
      today
    );

    setEndDate(
      today
    );
  }


  function setPresetYesterday() {

    const yesterday =
      localDateKey(
        shiftDate(
          new Date(),
          -1
        )
      );

    setStartDate(
      yesterday
    );

    setEndDate(
      yesterday
    );
  }


  function setPresetSevenDays() {

    const today =
      new Date();

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
              기본 조회기간은 오늘입니다.
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
                setRefreshKey(
                  value =>
                    value +
                    1
                )
            }
          >
            ↻ 새로고침
          </button>

        </div>


        <div className="distributionSummaryGrid">

          <div className="distributionSummaryCard">
            <span>
              선택기간 분배건수
            </span>

            <strong>
              {
                filteredCount
                  .toLocaleString(
                    "ko-KR"
                  )
              }
              건
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              선택기간 다이아
            </span>

            <strong>
              💎{" "}
              {
                filteredDiamond
                  .toLocaleString(
                    "ko-KR"
                  )
              }
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              전체 누적 분배건수
            </span>

            <strong>
              {
                totalCount
                  .toLocaleString(
                    "ko-KR"
                  )
              }
              건
            </strong>
          </div>


          <div className="distributionSummaryCard">
            <span>
              현재 페이지
            </span>

            <strong>
              {page} / {totalPages}
            </strong>
          </div>

        </div>


        <section className="distributionFilterCard">

          <div className="distributionQuickRange">

            <button
              type="button"
              onClick={
                setPresetToday
              }
            >
              오늘
            </button>

            <button
              type="button"
              onClick={
                setPresetYesterday
              }
            >
              어제
            </button>

            <button
              type="button"
              onClick={
                setPresetSevenDays
              }
            >
              최근 7일
            </button>

          </div>


          <div className="distributionFilterGrid">

            <label>
              <span>
                시작일
              </span>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={
                  event =>
                    setStartDate(
                      event.target.value
                    )
                }
              />
            </label>


            <label>
              <span>
                종료일
              </span>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={
                  event =>
                    setEndDate(
                      event.target.value
                    )
                }
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
                  event =>
                    setCategory(
                      event.target.value
                    )
                }
              >
                <option value="전체">
                  전체
                </option>

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
                  event =>
                    setSort(
                      event
                        .target
                        .value as
                        "latest" |
                        "oldest"
                    )
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

        </section>


        <section className="distributionResultsCard">

          <div className="distributionResultsHeader">

            <div>
              <h2>
                분배내역
              </h2>

              <span>
                {startDate} ~ {endDate}
              </span>
            </div>


            <div className="distributionResultsCount">
              {
                loading
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
            !error &&
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
            !loading &&
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
                page <=
                  1
              }
              onClick={
                () =>
                  setPage(
                    value =>
                      Math.max(
                        1,
                        value -
                          1
                      )
                  )
              }
            >
              ← 이전
            </button>


            <span>
              {page} / {totalPages}
            </span>


            <button
              type="button"
              disabled={
                loading ||
                page >=
                  totalPages
              }
              onClick={
                () =>
                  setPage(
                    value =>
                      Math.min(
                        totalPages,
                        value +
                          1
                      )
                  )
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
