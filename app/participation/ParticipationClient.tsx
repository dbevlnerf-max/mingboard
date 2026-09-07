"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./participation.module.css";


// ============================================================
// TYPES
// ============================================================

type Period = {
  id: string;
  name: string;
  start_at: string;
  end_at: string;

  status:
    | "open"
    | "closed";

  closed_at?:
    | string
    | null;
};


type RankingRow = {
  discordId: string;

  nickname: string;
  guild: string;

  participationCount: number;
  targetCount: number;

  baseScore: number;
  adjustmentScore: number;
  finalScore: number;

  participationRate: number;

  rank: number;

  distributionAmount: number;
};


type DetailRow = {
  eventId: string;

  eventType:
    | "boss"
    | "war"
    | "etc";

  eventName: string;

  description:
    | string
    | null;

  occurredAt: string;

  attended: boolean;

  score: number;

  checkedAt: string;
};


type Props = {
  currentDiscordId: string;
  currentUserName: string;
};


// ============================================================
// 숫자
// ============================================================

function numberValue(
  value: unknown
) {
  const result =
    Number(
      value ?? 0
    );


  return Number.isFinite(
    result
  )
    ? result
    : 0;
}


function formatScore(
  value: number
) {
  return numberValue(
    value
  ).toLocaleString(
    "ko-KR"
  );
}


function formatPercent(
  value: number
) {
  const result =
    numberValue(
      value
    );


  return `${result
    .toFixed(1)
    .replace(".0", "")}%`;
}


// ============================================================
// 날짜
// ============================================================

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  );
}


function formatShortDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  );
}


function formatDateTime(
  value: string
) {
  return new Date(
    value
  ).toLocaleString(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  );
}


function formatEndDate(
  value: string
) {
  const date =
    new Date(
      new Date(
        value
      ).getTime() - 1
    );


  return formatDate(
    date.toISOString()
  );
}


// ============================================================
// 현재 KST 월
// ============================================================

function currentKstMonth() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Seoul",

      year:
        "numeric",

      month:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


// ============================================================
// 월 상세조회 범위
//
// 2026-09
//
// 시작:
// 2026-09-01 00:00 KST
//
// 종료:
// 2026-10-01 00:00 KST
// ============================================================

function getMonthRange(
  monthText: string
) {
  const [
    year,
    month,
  ] =
    monthText
      .split("-")
      .map(Number);


  const start =
    new Date(
      `${year}-${String(
        month
      ).padStart(
        2,
        "0"
      )}-01T00:00:00+09:00`
    );


  let nextYear =
    year;

  let nextMonth =
    month + 1;


  if (
    nextMonth ===
    13
  ) {
    nextMonth =
      1;

    nextYear +=
      1;
  }


  const end =
    new Date(
      `${nextYear}-${String(
        nextMonth
      ).padStart(
        2,
        "0"
      )}-01T00:00:00+09:00`
    );


  return {
    start:
      start.toISOString(),

    end:
      end.toISOString(),
  };
}


// ============================================================
// 주간/월간 행 정규화
//
// 진행중 RPC = camelCase 가능
// 마감 snapshot = snake_case 가능
//
// 둘 다 처리
// ============================================================

function normalizeRankingRow(
  row: any,
  index: number
): RankingRow {
  return {
    discordId:
      String(
        row.discordId ??
        row.discord_id ??
        ""
      ),

    nickname:
      String(
        row.nickname ??
        row.nickname_snapshot ??
        "알 수 없음"
      ),

    guild:
      String(
        row.guild ??
        row.guild_snapshot ??
        ""
      ),

    participationCount:
      numberValue(
        row.participationCount ??
        row.participation_count
      ),

    targetCount:
      numberValue(
        row.targetCount ??
        row.target_count
      ),

    baseScore:
      numberValue(
        row.baseScore ??
        row.base_score
      ),

    adjustmentScore:
      numberValue(
        row.adjustmentScore ??
        row.adjustment_score
      ),

    finalScore:
      numberValue(
        row.finalScore ??
        row.final_score
      ),

    participationRate:
      numberValue(
        row.participationRate ??
        row.participation_rate
      ),

    rank:
      numberValue(
        row.rank
      ) ||
      index + 1,

    distributionAmount:
      numberValue(
        row.distributionAmount ??
        row.distribution_amount
      ),
  };
}


// ============================================================
// 상세행 정규화
// ============================================================

function normalizeDetailRow(
  row: any
): DetailRow {
  let eventType =
    String(
      row.eventType ??
      row.event_type ??
      "etc"
    );


  if (
    eventType !== "boss" &&
    eventType !== "war"
  ) {
    eventType =
      "etc";
  }


  return {
    eventId:
      String(
        row.eventId ??
        row.event_id ??
        row.bossEventId ??
        row.boss_event_id ??
        ""
      ),

    eventType:
      eventType as
        | "boss"
        | "war"
        | "etc",

    eventName:
      String(
        row.eventName ??
        row.event_name ??
        row.bossName ??
        row.boss_name ??
        "이벤트"
      ),

    description:
      row.description
        ? String(
            row.description
          )
        : null,

    occurredAt:
      String(
        row.occurredAt ??
        row.occurred_at ??
        ""
      ),

    attended:
      Boolean(
        row.attended ??
        true
      ),

    score:
      numberValue(
        row.score
      ),

    checkedAt:
      String(
        row.checkedAt ??
        row.checked_at ??
        row.occurredAt ??
        row.occurred_at ??
        ""
      ),
  };
}


// ============================================================
// EVENT LABEL
// ============================================================

function eventLabel(
  type: string
) {
  if (
    type ===
    "boss"
  ) {
    return "보스";
  }


  if (
    type ===
    "war"
  ) {
    return "쟁";
  }


  return "기타";
}


// ============================================================
// COMPONENT
// ============================================================

export default function ParticipationClient({
  currentDiscordId,
  currentUserName,
}: Props) {

  // ==========================================================
  // TAB
  // ==========================================================

  const [
    tab,
    setTab,
  ] =
    useState<
      "week"
      | "month"
    >(
      "week"
    );


  // ==========================================================
  // DATA
  // ==========================================================

  const [
    weekRows,
    setWeekRows,
  ] =
    useState<
      RankingRow[]
    >(
      []
    );


  const [
    monthRows,
    setMonthRows,
  ] =
    useState<
      RankingRow[]
    >(
      []
    );


  const [
    period,
    setPeriod,
  ] =
    useState<
      Period |
      null
    >(
      null
    );


  const [
    weekClosed,
    setWeekClosed,
  ] =
    useState(
      false
    );


  const [
    weekTargetCount,
    setWeekTargetCount,
  ] =
    useState(
      0
    );


  const [
    monthTargetCount,
    setMonthTargetCount,
  ] =
    useState(
      0
    );


  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState(
      currentKstMonth()
    );


  const [
    loadedMonth,
    setLoadedMonth,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    error,
    setError,
  ] =
    useState("");


  // ==========================================================
  // DETAIL
  // ==========================================================

  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<
      RankingRow |
      null
    >(
      null
    );


  const [
    detailRows,
    setDetailRows,
  ] =
    useState<
      DetailRow[]
    >(
      []
    );


  const [
    detailLoading,
    setDetailLoading,
  ] =
    useState(
      false
    );


  const [
    detailError,
    setDetailError,
  ] =
    useState("");


  const [
    detailFilter,
    setDetailFilter,
  ] =
    useState<
      "all"
      | "boss"
      | "war"
    >(
      "all"
    );


  // ==========================================================
  // WEEK
  // ==========================================================

  async function loadWeek() {
    setLoading(
      true
    );

    setError("");


    try {
      const response =
        await fetch(
          "/api/participation?mode=week",
          {
            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "주간 참여점수를 불러오지 못했습니다."
        );
      }


      const normalized =
        (
          data.rows ||
          []
        ).map(
          (
            row: any,
            index: number
          ) =>
            normalizeRankingRow(
              row,
              index
            )
        );


      setPeriod(
        data.period ||
        null
      );


      setWeekClosed(
        Boolean(
          data.closed
        )
      );


      setWeekRows(
        normalized
      );


      setWeekTargetCount(
        numberValue(
          data.targetCount ??
          normalized[0]
            ?.targetCount ??
          0
        )
      );


    } catch (
      error
    ) {
      setError(
        error instanceof Error
          ? error.message
          : "주간 참여점수를 불러오지 못했습니다."
      );


    } finally {
      setLoading(
        false
      );
    }
  }


  // ==========================================================
  // MONTH
  // ==========================================================

  async function loadMonth(
    month: string,
    force =
      false
  ) {
    if (
      !force &&
      loadedMonth ===
        month
    ) {
      return;
    }


    setLoading(
      true
    );

    setError("");


    try {
      const response =
        await fetch(
          `/api/participation?mode=month&month=${encodeURIComponent(
            month
          )}`,
          {
            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "월간 참여점수를 불러오지 못했습니다."
        );
      }


      const normalized =
        (
          data.rows ||
          []
        ).map(
          (
            row: any,
            index: number
          ) =>
            normalizeRankingRow(
              row,
              index
            )
        );


      setMonthRows(
        normalized
      );


      setMonthTargetCount(
        numberValue(
          data.targetCount ??
          normalized[0]
            ?.targetCount ??
          0
        )
      );


      setLoadedMonth(
        month
      );


    } catch (
      error
    ) {
      setError(
        error instanceof Error
          ? error.message
          : "월간 참여점수를 불러오지 못했습니다."
      );


    } finally {
      setLoading(
        false
      );
    }
  }


  // ==========================================================
  // FIRST LOAD
  // ==========================================================

  useEffect(
    () => {
      loadWeek();
    },
    []
  );


  // ==========================================================
  // CHANGE TAB
  // ==========================================================

  async function changeTab(
    next:
      "week"
      | "month"
  ) {
    setTab(
      next
    );


    setSelectedUser(
      null
    );


    if (
      next ===
      "week"
    ) {
      await loadWeek();

    } else {
      await loadMonth(
        selectedMonth
      );
    }
  }


  // ==========================================================
  // DETAIL
  // ==========================================================

  async function openDetail(
    row: RankingRow
  ) {
    if (
      !row.discordId
    ) {
      return;
    }


    let start:
      string;

    let end:
      string;


    if (
      tab ===
      "week"
    ) {
      if (
        !period
      ) {
        return;
      }


      start =
        period.start_at;

      end =
        period.end_at;

    } else {
      const range =
        getMonthRange(
          selectedMonth
        );


      start =
        range.start;

      end =
        range.end;
    }


    setSelectedUser(
      row
    );


    setDetailRows(
      []
    );


    setDetailError("");


    setDetailFilter(
      "all"
    );


    setDetailLoading(
      true
    );


    try {
      const params =
        new URLSearchParams({
          mode:
            "detail",

          discordId:
            row.discordId,

          start,

          end,
        });


      const response =
        await fetch(
          `/api/participation?${params.toString()}`,
          {
            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "상세 참여내역을 불러오지 못했습니다."
        );
      }


      setDetailRows(
        (
          data.rows ||
          []
        ).map(
          (
            detail:
              any
          ) =>
            normalizeDetailRow(
              detail
            )
        )
      );


    } catch (
      error
    ) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "상세 참여내역을 불러오지 못했습니다."
      );


    } finally {
      setDetailLoading(
        false
      );
    }
  }


  // ==========================================================
  // CURRENT
  // ==========================================================

  const rows =
    tab ===
    "week"
      ? weekRows
      : monthRows;


  const targetCount =
    tab ===
    "week"
      ? weekTargetCount
      : monthTargetCount;


  const myRow =
    rows.find(
      row =>
        row.discordId ===
        currentDiscordId
    );


  const totalScore =
    useMemo(
      () =>
        rows.reduce(
          (
            total,
            row
          ) =>
            total +
            row.finalScore,
          0
        ),
      [
        rows,
      ]
    );


  const filteredDetails =
    detailRows.filter(
      row =>
        detailFilter ===
          "all" ||
        row.eventType ===
          detailFilter
    );


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main
      className={
        styles.page
      }
    >

      <div
        className={
          styles.shell
        }
      >


        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <header
          className={
            styles.header
          }
        >

          <Link
            href="/"
            className={
              styles.brand
            }
          >
            ⚡ 게임하는밍쨩
          </Link>


          <nav
            className={
              styles.nav
            }
          >

            <Link href="/">
              대시보드
            </Link>


            <Link href="/boss">
              보스타임
            </Link>


            <Link
              href="/participation"
              className={
                styles.activeNav
              }
            >
              참여점수
            </Link>


            <Link href="/distribution-history">
              분배조회
            </Link>


            <Link href="/guild">
              길드현황
            </Link>


            <Link href="/admin">
              관리자
            </Link>

          </nav>


          <div
            className={
              styles.user
            }
          >
            {currentUserName}
          </div>

        </header>



        <div
          className={
            styles.content
          }
        >


          {/* ================================================= */}
          {/* HERO */}
          {/* ================================================= */}

          <section
            className={
              styles.hero
            }
          >

            <div>

              <span>
                MINGBOT PARTICIPATION
              </span>


              <h1>
                참여점수
              </h1>


              <p>
                보스타임 · 쟁 · 출석체크 기록을 기준으로 집계합니다.
              </p>

            </div>


            <button
              type="button"
              className={
                styles.refreshButton
              }
              onClick={
                () => {
                  if (
                    tab ===
                    "week"
                  ) {
                    loadWeek();

                  } else {
                    loadMonth(
                      selectedMonth,
                      true
                    );
                  }
                }
              }
            >
              ↻ 새로고침
            </button>

          </section>



          {/* ================================================= */}
          {/* TABS */}
          {/* ================================================= */}

          <div
            className={
              styles.tabs
            }
          >

            <button
              type="button"
              className={
                tab ===
                "week"
                  ? styles.activeTab
                  : ""
              }
              onClick={
                () =>
                  changeTab(
                    "week"
                  )
              }
            >
              주간 순위
            </button>


            <button
              type="button"
              className={
                tab ===
                "month"
                  ? styles.activeTab
                  : ""
              }
              onClick={
                () =>
                  changeTab(
                    "month"
                  )
              }
            >
              월간 순위
            </button>

          </div>



          {/* ================================================= */}
          {/* PERIOD */}
          {/* ================================================= */}

          <section
            className={
              styles.periodBar
            }
          >

            {
              tab ===
              "week"
                ? (

                  period
                    ? (
                      <>

                        <div
                          className={
                            styles.periodInfo
                          }
                        >

                          <span>
                            {
                              weekClosed
                                ? "마감된 집계"
                                : "현재 집계"
                            }
                          </span>


                          <strong>
                            {period.name}
                          </strong>

                        </div>


                        <p>
                          {
                            formatDate(
                              period.start_at
                            )
                          }

                          {" ~ "}

                          {
                            formatEndDate(
                              period.end_at
                            )
                          }
                        </p>

                      </>
                    )
                    : (
                      <p>
                        현재 진행중인 집계기간이 없습니다.
                      </p>
                    )

                )
                : (
                  <>

                    <div
                      className={
                        styles.periodInfo
                      }
                    >

                      <span>
                        월간 집계
                      </span>


                      <strong>
                        KST 00:00 기준
                      </strong>

                    </div>


                    <input
                      type="month"
                      value={
                        selectedMonth
                      }
                      onChange={
                        async event => {
                          const month =
                            event.target.value;


                          setSelectedMonth(
                            month
                          );


                          if (
                            month
                          ) {
                            await loadMonth(
                              month,
                              true
                            );
                          }
                        }
                      }
                    />

                  </>
                )
            }

          </section>



          {/* ================================================= */}
          {/* ERROR */}
          {/* ================================================= */}

          {
            error &&
            (
              <div
                className={
                  styles.error
                }
              >
                {error}
              </div>
            )
          }



          {/* ================================================= */}
          {/* SUMMARY */}
          {/* ================================================= */}

          <section
            className={
              styles.summaryGrid
            }
          >

            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                내 순위
              </span>

              <strong>
                {
                  myRow
                    ? `${myRow.rank}위`
                    : "-"
                }
              </strong>
            </div>


            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                내 참여
              </span>

              <strong>
                {
                  myRow
                    ? `${myRow.participationCount}회`
                    : "-"
                }
              </strong>
            </div>


            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                내 점수
              </span>

              <strong>
                {
                  myRow
                    ? `${formatScore(
                        myRow.finalScore
                      )}점`
                    : "-"
                }
              </strong>
            </div>


            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                내 참여율
              </span>

              <strong>
                {
                  myRow
                    ? formatPercent(
                        myRow.participationRate
                      )
                    : "-"
                }
              </strong>
            </div>


            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                대상 횟수
              </span>

              <strong>
                {
                  targetCount.toLocaleString(
                    "ko-KR"
                  )
                }
                회
              </strong>
            </div>


            <div
              className={
                styles.summaryCard
              }
            >
              <span>
                전체 참여점수
              </span>

              <strong>
                {
                  formatScore(
                    totalScore
                  )
                }
                점
              </strong>
            </div>

          </section>



          {/* ================================================= */}
          {/* RANKING */}
          {/* ================================================= */}

          <section
            className={
              styles.rankingSection
            }
          >

            <div
              className={
                styles.sectionHeader
              }
            >

              <div>

                <span>
                  RANKING
                </span>


                <h2>
                  {
                    tab ===
                    "week"
                      ? "주간 참여 순위"
                      : `${selectedMonth} 월간 참여 순위`
                  }
                </h2>

              </div>


              <p>
                닉네임을 누르면 상세 참여내역을 확인할 수 있습니다.
              </p>

            </div>



            <div
              className={
                styles.table
              }
            >

              <div
                className={
                  styles.tableHeader
                }
              >

                <span>
                  순위
                </span>

                <span>
                  닉네임
                </span>

                <span>
                  길드
                </span>

                <span>
                  참여
                </span>

                <span>
                  점수
                </span>

                <span>
                  참여율
                </span>

              </div>


              {
                loading
                  ? (
                    <div
                      className={
                        styles.empty
                      }
                    >
                      참여점수를 불러오는 중...
                    </div>
                  )
                  : rows.length ===
                    0
                  ? (
                    <div
                      className={
                        styles.empty
                      }
                    >
                      아직 집계된 참여기록이 없습니다.
                    </div>
                  )
                  : rows.map(
                      row => (
                        <div
                          key={
                            row.discordId
                          }
                          className={
                            `${styles.tableRow} ${
                              row.discordId ===
                              currentDiscordId
                                ? styles.myRow
                                : ""
                            }`
                          }
                        >

                          <span
                            className={
                              styles.rank
                            }
                          >
                            {
                              row.rank ===
                              1
                                ? "🥇 1위"
                                : row.rank ===
                                  2
                                ? "🥈 2위"
                                : row.rank ===
                                  3
                                ? "🥉 3위"
                                : `${row.rank}위`
                            }
                          </span>


                          <button
                            type="button"
                            className={
                              styles.nickname
                            }
                            onClick={
                              () =>
                                openDetail(
                                  row
                                )
                            }
                          >
                            {
                              row.nickname
                            }


                            {
                              row.discordId ===
                              currentDiscordId &&
                              (
                                <small>
                                  ME
                                </small>
                              )
                            }

                          </button>


                          <span>
                            {
                              row.guild ||
                              "-"
                            }
                          </span>


                          <strong>
                            {
                              row.participationCount
                            }
                            회
                          </strong>


                          <strong
                            className={
                              styles.score
                            }
                          >
                            {
                              formatScore(
                                row.finalScore
                              )
                            }
                            점
                          </strong>


                          <span>
                            {
                              formatPercent(
                                row.participationRate
                              )
                            }
                          </span>

                        </div>
                      )
                    )
              }

            </div>

          </section>


        </div>

      </div>



      {/* =================================================== */}
      {/* DETAIL MODAL */}
      {/* =================================================== */}

      {
        selectedUser &&
        (
          <div
            className={
              styles.modalBackdrop
            }
            onMouseDown={
              event => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  setSelectedUser(
                    null
                  );
                }
              }
            }
          >

            <div
              className={
                styles.modal
              }
            >

              {/* ============================================= */}
              {/* MODAL HEADER */}
              {/* ============================================= */}

              <div
                className={
                  styles.modalHeader
                }
              >

                <div>

                  <span>
                    PARTICIPATION DETAIL
                  </span>


                  <h2>
                    {
                      selectedUser.nickname
                    }
                  </h2>


                  <p>
                    {
                      tab ===
                      "week"
                        ? period?.name
                        : `${selectedMonth} 월간`
                    }
                  </p>

                </div>


                <button
                  type="button"
                  onClick={
                    () =>
                      setSelectedUser(
                        null
                      )
                  }
                >
                  ✕
                </button>

              </div>



              {/* ============================================= */}
              {/* DETAIL SUMMARY */}
              {/* ============================================= */}

              <div
                className={
                  styles.detailSummary
                }
              >

                <div>
                  <span>
                    순위
                  </span>

                  <strong>
                    {
                      selectedUser.rank
                    }
                    위
                  </strong>
                </div>


                <div>
                  <span>
                    참여
                  </span>

                  <strong>
                    {
                      selectedUser.participationCount
                    }
                    회
                  </strong>
                </div>


                <div>
                  <span>
                    점수
                  </span>

                  <strong>
                    {
                      formatScore(
                        selectedUser.finalScore
                      )
                    }
                    점
                  </strong>
                </div>


                <div>
                  <span>
                    참여율
                  </span>

                  <strong>
                    {
                      formatPercent(
                        selectedUser.participationRate
                      )
                    }
                  </strong>
                </div>

              </div>



              {/* ============================================= */}
              {/* FILTER */}
              {/* ============================================= */}

              <div
                className={
                  styles.detailFilters
                }
              >

                <button
                  type="button"
                  className={
                    detailFilter ===
                    "all"
                      ? styles.activeFilter
                      : ""
                  }
                  onClick={
                    () =>
                      setDetailFilter(
                        "all"
                      )
                  }
                >
                  전체
                </button>


                <button
                  type="button"
                  className={
                    detailFilter ===
                    "boss"
                      ? styles.activeFilter
                      : ""
                  }
                  onClick={
                    () =>
                      setDetailFilter(
                        "boss"
                      )
                  }
                >
                  보스
                </button>


                <button
                  type="button"
                  className={
                    detailFilter ===
                    "war"
                      ? styles.activeFilter
                      : ""
                  }
                  onClick={
                    () =>
                      setDetailFilter(
                        "war"
                      )
                  }
                >
                  쟁
                </button>

              </div>



              {/* ============================================= */}
              {/* DETAIL LIST */}
              {/* ============================================= */}

              <div
                className={
                  styles.detailList
                }
              >

                {
                  detailLoading
                    ? (
                      <div
                        className={
                          styles.detailEmpty
                        }
                      >
                        상세 참여내역을 불러오는 중...
                      </div>
                    )
                    : detailError
                    ? (
                      <div
                        className={
                          styles.detailError
                        }
                      >
                        {detailError}
                      </div>
                    )
                    : filteredDetails.length ===
                      0
                    ? (
                      <div
                        className={
                          styles.detailEmpty
                        }
                      >
                        해당 참여기록이 없습니다.
                      </div>
                    )
                    : filteredDetails.map(
                        (
                          row,
                          index
                        ) => (
                          <div
                            key={
                              `${row.eventId}-${row.checkedAt}-${index}`
                            }
                            className={
                              styles.detailRow
                            }
                          >

                            <div
                              className={
                                styles.detailType
                              }
                            >
                              {
                                row.eventType ===
                                "boss"
                                  ? "⚔️"
                                  : row.eventType ===
                                    "war"
                                  ? "🔥"
                                  : "📌"
                              }
                            </div>


                            <div
                              className={
                                styles.detailMain
                              }
                            >

                              <div>

                                <span>
                                  {
                                    eventLabel(
                                      row.eventType
                                    )
                                  }
                                </span>


                                <strong>
                                  {
                                    row.eventName
                                  }
                                </strong>

                              </div>


                              <p>
                                {
                                  row.occurredAt
                                    ? formatDateTime(
                                        row.occurredAt
                                      )
                                    : "-"
                                }


                                {
                                  row.description &&
                                  (
                                    <>
                                      {" · "}
                                      {
                                        row.description
                                      }
                                    </>
                                  )
                                }
                              </p>

                            </div>


                            <strong
                              className={
                                row.score ===
                                0
                                  ? styles.detailZeroScore
                                  : styles.detailScore
                              }
                            >
                              {
                                row.score > 0
                                  ? "+"
                                  : ""
                              }

                              {
                                formatScore(
                                  row.score
                                )
                              }
                              점
                            </strong>

                          </div>
                        )
                      )
                }

              </div>

            </div>

          </div>
        )
      }

    </main>
  );
}