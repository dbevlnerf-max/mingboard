"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import AppTopBar from "@/app/components/AppTopBar";

import {
  signIn,
  signOut,
  useSession,
} from "next-auth/react";


type Notice = {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};


type Guide = {
  id: number;
  title: string;
  content: string;
  updated_by: string | null;
  updated_at: string;
};


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


type GuildMember = {
  gid: string;
  nickname: string;
  job: string;
  growthPower: string;
  growthPowerNumber: number;
  guild: string;
  attendanceRate: string;
  participationCount: number;
  targetCount: number;
};


type GuildCounts = {
  total: number;
  pink: number;
  red: number;
  black: number;
};


type BossTimer = {
  id: string;
  name: string;
  aliases: string[];
  level: number | null;
  spawnType:
    | "interval"
    | "fixed";
  intervalMinutes: number | null;
  fixedTimes: string[];
  description: string;
  sortOrder: number;
  lastSpawnAt: string | null;
  nextSpawnAt: string | null;
  stateSource:
    | "manual"
    | "mingbot"
    | "system"
    | null;
  stateUpdatedAt: string | null;
};


function formatBossCycle(
  minutes:
    number |
    null
) {

  if (
    !minutes ||
    minutes <= 0
  ) {
    return "-";
  }


  if (
    minutes % 60 === 0
  ) {
    return `${minutes / 60}시간`;
  }


  const hours =
    Math.floor(
      minutes / 60
    );

  const remainMinutes =
    minutes % 60;


  if (
    hours <= 0
  ) {
    return `${remainMinutes}분`;
  }


  return `${hours}시간 ${remainMinutes}분`;
}


function formatTimeOnly(
  value: Date
) {

  return value
    .toLocaleTimeString(
      "ko-KR",
      {
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false,
      }
    );
}



const categories = [
  "전체",
  "무기",
  "보조무기",
  "방어구",
  "장신구",
  "영웅스킬",
  "신석",
  "기타",
];


function getNextTime(
  hour: number,
  minute: number
) {
  const now = new Date();
  const target = new Date();

  target.setHours(
    hour,
    minute,
    0,
    0
  );

  if (
    target <= now
  ) {
    target.setDate(
      target.getDate() + 1
    );
  }

  return target;
}


function getNextFixedTime(
  times: string[]
) {
  const now = new Date();

  const candidates = times
    .map(time => {
      const [hour, minute] = time
        .split(":")
        .map(Number);

      const target = new Date();
      target.setHours(
        hour,
        minute,
        0,
        0
      );

      if (target <= now) {
        target.setDate(
          target.getDate() + 1
        );
      }

      return { time, target };
    })
    .sort(
      (a, b) =>
        a.target.getTime() -
        b.target.getTime()
    );

  return candidates[0];
}


function formatNextSpawn(
  target: Date
) {
  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );

  const dayDiff = Math.round(
    (targetStart.getTime() - todayStart.getTime()) /
      86400000
  );

  const time = target.toLocaleTimeString(
    "ko-KR",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );

  if (dayDiff === 0) {
    return `오늘 ${time}`;
  }

  if (dayDiff === 1) {
    return `내일 ${time}`;
  }

  return `${String(target.getMonth() + 1).padStart(
    2,
    "0"
  )}/${String(target.getDate()).padStart(
    2,
    "0"
  )} ${time}`;
}


function formatRemain(
  target: Date
) {
  const diff =
    target.getTime() -
    Date.now();

  if (
    diff <= 0
  ) {
    return "젠 완료";
  }

  const total =
    Math.floor(
      diff / 1000
    );

  const h =
    Math.floor(
      total / 3600
    );

  const m =
    Math.floor(
      (total % 3600) / 60
    );

  const s =
    total % 60;

  return [
    h,
    m,
    s,
  ]
    .map(
      value =>
        String(
          value
        ).padStart(
          2,
          "0"
        )
    )
    .join(":");
}


function formatNoticeDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "ko-KR",
    {
      month: "2-digit",
      day: "2-digit",
    }
  );
}


function parsePercent(
  value: string
) {
  return (
    Number(
      String(
        value || "0"
      )
        .replace(
          "%",
          ""
        )
        .replace(
          ",",
          ""
        )
        .trim()
    ) || 0
  );
}



function formatCompactNumber(value: number) {
  if (value >= 100000) {
    return `${Math.round(value / 1000)}K`;
  }

  if (value >= 10000) {
    return `${(value / 1000).toFixed(0)}K`;
  }

  return value.toLocaleString("ko-KR");
}

function buildGrowthBuckets(members: GuildMember[]) {
  const values = members
    .map(member => Number(member.growthPowerNumber || 0))
    .filter(value => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const targetBucketCount = Math.min(5, Math.max(1, values.length));

  if (min === max) {
    return [
      {
        label: formatCompactNumber(min),
        min,
        max,
        count: values.length,
      },
    ];
  }

  const rawStep = (max - min) / targetBucketCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceFactor =
    normalized <= 1
      ? 1
      : normalized <= 2
      ? 2
      : normalized <= 5
      ? 5
      : 10;
  const step = Math.max(1000, niceFactor * magnitude);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil((max + 1) / step) * step;
  const buckets: Array<{
    label: string;
    min: number;
    max: number;
    count: number;
  }> = [];

  for (let current = start; current < end; current += step) {
    const upper = current + step;
    const isLast = upper >= end;
    const count = values.filter(value =>
      isLast
        ? value >= current && value <= upper
        : value >= current && value < upper
    ).length;

    buckets.push({
      label: `${formatCompactNumber(current)}~${formatCompactNumber(upper)}`,
      min: current,
      max: upper,
      count,
    });
  }

  return buckets;
}

export default function Home() {

  const {
    data: session,
    status,
  } =
    useSession();


  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );


  const [
    bossTimers,
    setBossTimers,
  ] =
    useState<
      BossTimer[]
    >(
      []
    );


  const [
    bossLoading,
    setBossLoading,
  ] =
    useState(true);


  const [
    bossError,
    setBossError,
  ] =
    useState("");


  const [
    distributionRows,
    setDistributionRows,
  ] =
    useState<DistributionRow[]>(
      []
    );


  const [
    distributionCategories,
    setDistributionCategories,
  ] =
    useState<string[]>(
      []
    );


  const [
    category,
    setCategory,
  ] =
    useState(
      "전체"
    );


  const [
    distributionSort,
    setDistributionSort,
  ] =
    useState<"latest" | "oldest">(
      "latest"
    );


  const [
    distributionStartDate,
    setDistributionStartDate,
  ] =
    useState("");


  const [
    distributionEndDate,
    setDistributionEndDate,
  ] =
    useState("");


  const [
    distributionPage,
    setDistributionPage,
  ] =
    useState(1);


  const [
    distributionLoading,
    setDistributionLoading,
  ] =
    useState(false);


  const [
    distributionMessage,
    setDistributionMessage,
  ] =
    useState("");


  /* =====================================================
     NOTICE
  ===================================================== */

  const [
    notices,
    setNotices,
  ] =
    useState<Notice[]>(
      []
    );


  const [
    noticesLoading,
    setNoticesLoading,
  ] =
    useState(false);


  const [
    noticeError,
    setNoticeError,
  ] =
    useState("");


  const [
    openedNoticeId,
    setOpenedNoticeId,
  ] =
    useState<number | null>(
      null
    );


  /* =====================================================
     GUIDE
  ===================================================== */

  const [
    guide,
    setGuide,
  ] =
    useState<Guide | null>(
      null
    );


  const [
    guideLoading,
    setGuideLoading,
  ] =
    useState(false);


  const [
    guideError,
    setGuideError,
  ] =
    useState("");


  /* =====================================================
     GUILD
  ===================================================== */

  const [
    guildMembers,
    setGuildMembers,
  ] =
    useState<GuildMember[]>(
      []
    );


  const [
    guildCounts,
    setGuildCounts,
  ] =
    useState<GuildCounts>({
      total: 0,
      pink: 0,
      red: 0,
      black: 0,
    });


  const [
    guildJobs,
    setGuildJobs,
  ] =
    useState<string[]>(
      []
    );


  const [
    guildLoading,
    setGuildLoading,
  ] =
    useState(false);


  const [
    guildError,
    setGuildError,
  ] =
    useState("");


  const [
    guildFilter,
    setGuildFilter,
  ] =
    useState(
      "전체"
    );


  const [
    jobFilter,
    setJobFilter,
  ] =
    useState(
      "전체"
    );


  const [
    guildSearch,
    setGuildSearch,
  ] =
    useState("");


  const [
    guildSort,
    setGuildSort,
  ] =
    useState(
      "growthDesc"
    );


  const [
    pageSize,
    setPageSize,
  ] =
    useState(10);


  const [
    currentPage,
    setCurrentPage,
  ] =
    useState(1);


  const [
    jobRankIndex,
    setJobRankIndex,
  ] =
    useState(0);


  /* =====================================================
     CLOCK
  ===================================================== */

  useEffect(
    () => {

      const timer =
        setInterval(
          () =>
            setNow(
              new Date()
            ),
          1000
        );


      return () =>
        clearInterval(
          timer
        );

    },
    []
  );


  /* =====================================================
     LIVE BOSS TIME
  ===================================================== */

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


      let disposed =
        false;


      async function loadBossTimes() {

        try {

          const response =
            await fetch(
              "/api/boss-times",
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
              "보스타임을 불러오지 못했습니다."
            );
          }


          if (
            disposed
          ) {
            return;
          }


          setBossTimers(
            Array.isArray(
              data.bosses
            )
              ? data.bosses
              : []
          );

          setBossError("");


        } catch (
          error
        ) {

          if (
            disposed
          ) {
            return;
          }


          console.error(
            "[보스타임 조회]",
            error
          );


          setBossError(
            error instanceof Error
              ? error.message
              : "보스타임을 불러오지 못했습니다."
          );

        } finally {

          if (
            !disposed
          ) {
            setBossLoading(
              false
            );
          }
        }
      }


      loadBossTimes();


      // 밍봇 .컷 결과를 별도 새로고침 없이 반영
      // 15초 간격이면 운영 부하가 매우 낮으면서 충분히 빠릅니다.
      const timer =
        window.setInterval(
          loadBossTimes,
          15000
        );


      return () => {

        disposed =
          true;

        window.clearInterval(
          timer
        );
      };

    },
    [
      status,
      session?.user,
    ]
  );


  /* =====================================================
     LOAD
  ===================================================== */

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
          ?.isGuildMember ||
        !session.user
          .hasZeusRole
      ) {
        return;
      }


      async function loadNotices() {

        setNoticesLoading(
          true
        );

        setNoticeError("");


        try {

          const response =
            await fetch(
              "/api/notices",
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
              "공지사항을 불러오지 못했습니다."
            );
          }


          setNotices(
            data.notices ||
            []
          );

        } catch (
          error
        ) {

          console.error(
            error
          );


          setNoticeError(
            "공지사항을 불러오지 못했습니다."
          );

        } finally {

          setNoticesLoading(
            false
          );
        }
      }


      async function loadGuide() {

        setGuideLoading(
          true
        );

        setGuideError("");


        try {

          const response =
            await fetch(
              "/api/dashboard-guide",
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
              "안내사항을 불러오지 못했습니다."
            );
          }


          setGuide(
            data.guide ||
            null
          );

        } catch (
          error
        ) {

          console.error(
            error
          );


          setGuideError(
            "안내사항을 불러오지 못했습니다."
          );

        } finally {

          setGuideLoading(
            false
          );
        }
      }


      async function loadGuild() {

        setGuildLoading(
          true
        );

        setGuildError("");


        try {

          const response =
            await fetch(
              "/api/guild",
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
              "길드현황을 불러오지 못했습니다."
            );
          }


          setGuildMembers(
            data.members ||
            []
          );


          setGuildCounts(
            data.counts || {
              total: 0,
              pink: 0,
              red: 0,
              black: 0,
            }
          );


          setGuildJobs(
            data.jobs ||
            []
          );

        } catch (
          error
        ) {

          console.error(
            error
          );


          setGuildError(
            "길드현황을 불러오지 못했습니다."
          );

        } finally {

          setGuildLoading(
            false
          );
        }
      }


      loadNotices();
      loadGuide();
      loadGuild();

    },
    [
      status,
      session?.user
        ?.isGuildMember,
      session?.user
        ?.hasZeusRole,
    ]
  );


  /* =====================================================
     FILTER 변경시 1페이지
  ===================================================== */

  useEffect(
    () => {

      setCurrentPage(
        1
      );

    },
    [
      guildFilter,
      jobFilter,
      guildSearch,
      guildSort,
      pageSize,
    ]
  );


  /* =====================================================
     DISTRIBUTION LIST
  ===================================================== */

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
          ?.isGuildMember ||
        !session.user
          .hasZeusRole
      ) {
        return;
      }


      let disposed =
        false;


      async function loadDistribution() {

        setDistributionLoading(
          true
        );

        setDistributionMessage(
          ""
        );


        try {

          const response =
            await fetch(
              "/api/distribution",
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
              "분배내역을 불러오지 못했습니다."
            );
          }


          if (
            disposed
          ) {
            return;
          }


          setDistributionRows(
            Array.isArray(
              data.rows
            )
              ? data.rows
              : []
          );


          setDistributionCategories(
            Array.isArray(
              data.categories
            )
              ? data.categories
              : []
          );


        } catch (error) {

          if (
            disposed
          ) {
            return;
          }


          console.error(
            "[분배내역 조회]",
            error
          );


          setDistributionRows(
            []
          );


          setDistributionMessage(
            error instanceof Error
              ? error.message
              : "분배내역을 불러오지 못했습니다."
          );

        } finally {

          if (
            !disposed
          ) {
            setDistributionLoading(
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
      session?.user
        ?.isGuildMember,
      session?.user
        ?.hasZeusRole,
    ]
  );


  useEffect(
    () => {
      setDistributionPage(
        1
      );
    },
    [
      category,
      distributionSort,
      distributionStartDate,
      distributionEndDate,
    ]
  );


  /* =====================================================
     SESSION LOADING
  ===================================================== */

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


  /* =====================================================
     LOGIN
  ===================================================== */

  if (
    !session
  ) {

    return (

      <main className="authPage">

        <div className="authShell">


          <header className="authHeader">

            <div>

              <div className="authHeaderLogo">

                <span>
                  ⚡
                </span>

                게임하는밍쨩

              </div>


              <div className="authHeaderSub">
                ZEUS : 오만의 신 · 아프로디테 2서버
              </div>

            </div>


            <div className="authHeaderBadge">
              Management Dashboard
            </div>

          </header>



          <section className="authMain">


            <aside className="authSideLeft">

              <div className="authSectionLabel">
                GUILD SUPPORT
              </div>


              <h2 className="authSideTitle">
                문의 / 운영진
              </h2>


              <div className="operatorGrid">

                <div className="operatorCard markedOperator">

                  <span className="operatorBadge crownBadge">
                    👑
                  </span>

                  밍쨩유투브

                </div>


                <div className="operatorCard markedOperator">

                  <span className="operatorBadge swordBadge">
                    ⚔️
                  </span>

                  민짜

                </div>


                <div className="operatorCard">
                  좌심방
                </div>


                <div className="operatorCard">
                  김삐삐
                </div>

              </div>


              <div className="supportNote">
                인게임 귓말 또는 오픈카톡 문의
              </div>


              <div className="supportSubNote">
                디스코드 및 대시보드 관련문의 · 좌심방
              </div>

            </aside>



            <section className="authCenter">

              <div className="authKicker">
                APHRODITE 02 · VERIFIED ACCESS
              </div>


              <h1 className="authTitle">
                밍보드
              </h1>


              <div className="authIdentityLine">

                <span>
                  아프로디테 2서버
                </span>

                <span className="identityDot">
                  ·
                </span>

                <span>
                  길드원 전용 통합관리페이지
                </span>

              </div>


              <div className="guildNameRow">

                <span className="guildName pinkGuild">
                  핑뚝
                </span>

                <span>
                  ·
                </span>

                <span className="guildName redGuild">
                  빨뚝
                </span>

                <span>
                  ·
                </span>

                <span className="guildName blackGuild">
                  검뚝
                </span>

              </div>


              <div className="featureRow">

                <span>
                  ⏰ 보스타임
                </span>

                <span>
                  💎 분배조회
                </span>

                <span>
                  👥 길드현황
                </span>

                <span>
                  🏆 참여점수
                </span>

              </div>


              <div className="authAction">

                <button
                  className="discordAuthButton"

                  onClick={
                    () =>
                      signIn(
                        "discord"
                      )
                  }
                >

                  <span className="discordAuthIcon">
                    ◉
                  </span>

                  Discord로 인증하고 입장

                </button>


                <div className="authSecurityText">

                  게임하는밍쨩 Discord 서버의

                  <strong>
                    {" "}
                    제우스 역할 인증 사용자
                  </strong>

                  만 이용할 수 있습니다.

                </div>

              </div>

            </section>



            <aside className="authSideRight">

              <div className="characterStage">

                <div className="characterGlow" />

                <img
                  src="/mingzzang.png"
                  alt="밍쨩 캐릭터"
                  className="authCharacterImage"
                />

              </div>

            </aside>


          </section>



          <footer className="authFooter">

            <span>
              게임하는밍쨩 · ZEUS : 오만의 신
            </span>

            <span>
              아프로디테 2 · 핑뚝 / 빨뚝 / 검뚝
            </span>

          </footer>


        </div>

      </main>

    );
  }


  /* =====================================================
     SERVER CHECK
  ===================================================== */

  if (
    !session.user
      .isGuildMember
  ) {

    return (

      <main className="loginStatusPage">

        <div className="accessDeniedCard">

          <div className="accessDeniedIcon">
            🔒
          </div>

          <h2>
            서버 인증이 필요합니다.
          </h2>

          <p>
            게임하는밍쨩 Discord 서버 참가자만 이용할 수 있습니다.
          </p>

          <button
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


  if (
    !session.user
      .hasZeusRole
  ) {

    return (

      <main className="loginStatusPage">

        <div className="accessDeniedCard">

          <div className="accessDeniedIcon">
            🛡️
          </div>

          <h2>
            제우스 인증 역할이 필요합니다.
          </h2>

          <p>

            Discord 서버에서

            <strong>
              {" "}
              제우스
            </strong>

            {" "}
            역할을 부여받은 후 이용할 수 있습니다.

          </p>

          <button
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


  /* =====================================================
     DISTRIBUTION
  ===================================================== */

  const filteredDistributionRows =
    distributionRows
      .filter(
        row => {

          const categoryMatch =
            category ===
              "전체" ||
            row.category ===
              category;


          const startMatch =
            !distributionStartDate ||
            !row.dateKey ||
            row.dateKey >=
              distributionStartDate;


          const endMatch =
            !distributionEndDate ||
            !row.dateKey ||
            row.dateKey <=
              distributionEndDate;


          return (
            categoryMatch &&
            startMatch &&
            endMatch
          );
        }
      )
      .sort(
        (a, b) => {

          const aKey =
            a.dateKey ||
            "0000-00-00";

          const bKey =
            b.dateKey ||
            "0000-00-00";


          const dateCompare =
            distributionSort ===
              "latest"
              ? bKey.localeCompare(
                  aKey
                )
              : aKey.localeCompare(
                  bKey
                );


          if (
            dateCompare !==
            0
          ) {
            return dateCompare;
          }


          return (
            distributionSort ===
              "latest"
              ? b.rowNumber -
                a.rowNumber
              : a.rowNumber -
                b.rowNumber
          );
        }
      );


  const distributionPageSize =
    20;


  const distributionTotalPages =
    Math.max(
      1,
      Math.ceil(
        filteredDistributionRows.length /
        distributionPageSize
      )
    );


  const safeDistributionPage =
    Math.min(
      distributionPage,
      distributionTotalPages
    );


  const distributionPageRows =
    filteredDistributionRows.slice(
      (
        safeDistributionPage -
        1
      ) *
        distributionPageSize,
      safeDistributionPage *
        distributionPageSize
    );


  const filteredDiamond =
    filteredDistributionRows.reduce(
      (sum, row) =>
        sum +
        Number(
          row.diamond ||
          0
        ),
      0
    );


  const linkedDistributionMembers =
    new Set(
      filteredDistributionRows
        .filter(
          row =>
            Boolean(
              row.member
            )
        )
        .map(
          row =>
            row.member
              ?.gid ||
            row.target
        )
    ).size;


  /* =====================================================
     NOTICE
  ===================================================== */

  const visibleNotices =
    notices.slice(
      0,
      3
    );


  /* =====================================================
     GUIDE
  ===================================================== */

  const guideLines =
    guide?.content
      ?.split("\n")
      .map(
        line =>
          line.trim()
      )
      .filter(
        Boolean
      ) ||
    [];


  /* =====================================================
     GUILD FILTER
  ===================================================== */

  const filteredGuildMembers =
    guildMembers.filter(
      member => {

        const guildMatch =
          guildFilter ===
          "전체"
            ? true
            : member.guild ===
              guildFilter;


        const jobMatch =
          jobFilter ===
          "전체"
            ? true
            : member.job ===
              jobFilter;


        const keyword =
          guildSearch
            .trim()
            .toLowerCase();


        const searchMatch =
          keyword === ""
            ? true
            : member.nickname
                .toLowerCase()
                .includes(
                  keyword
                );


        return (
          guildMatch &&
          jobMatch &&
          searchMatch
        );
      }
    );


  /* =====================================================
     GUILD SORT
  ===================================================== */

  const sortedGuildMembers =
    [
      ...filteredGuildMembers,
    ].sort(
      (
        a,
        b
      ) => {

        if (
          guildSort ===
          "growthDesc"
        ) {

          return (
            b.growthPowerNumber -
            a.growthPowerNumber
          );
        }


        if (
          guildSort ===
          "growthAsc"
        ) {

          return (
            a.growthPowerNumber -
            b.growthPowerNumber
          );
        }


        if (
          guildSort ===
          "nickname"
        ) {

          return a.nickname.localeCompare(
            b.nickname,
            "ko"
          );
        }


        if (
          guildSort ===
          "attendanceDesc"
        ) {

          return (
            parsePercent(
              b.attendanceRate
            ) -
            parsePercent(
              a.attendanceRate
            )
          );
        }


        if (
          guildSort ===
          "participationDesc"
        ) {

          return (
            b.participationCount -
            a.participationCount
          );
        }


        return 0;
      }
    );


  /* =====================================================
     PAGINATION
  ===================================================== */

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedGuildMembers.length /
        pageSize
      )
    );


  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    );


  const startIndex =
    (
      safeCurrentPage -
      1
    ) *
    pageSize;


  const paginatedGuildMembers =
    sortedGuildMembers.slice(
      startIndex,
      startIndex +
        pageSize
    );


  const jobDistribution =
    Object.entries(
      guildMembers.reduce<Record<string, number>>(
        (acc, member) => {
          const job =
            member.job.trim() ||
            "미지정";

          acc[job] =
            (acc[job] || 0) + 1;

          return acc;
        },
        {}
      )
    )
      .map(([job, count]) => ({
        job,
        count,
      }))
      .sort((a, b) =>
        b.count - a.count ||
        a.job.localeCompare(b.job, "ko")
      );


  const maxJobCount =
    Math.max(
      1,
      ...jobDistribution.map(
        item => item.count
      )
    );


  const growthBuckets =
    buildGrowthBuckets(
      guildMembers
    );


  const maxGrowthBucketCount =
    Math.max(
      1,
      ...growthBuckets.map(
        item => item.count
      )
    );


  const validGrowthValues =
    guildMembers
      .map(member =>
        Number(
          member.growthPowerNumber || 0
        )
      )
      .filter(value =>
        Number.isFinite(value) &&
        value > 0
      );


  const averageGrowth =
    validGrowthValues.length > 0
      ? Math.round(
          validGrowthValues.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
            validGrowthValues.length
        )
      : 0;


  const highestGrowth =
    validGrowthValues.length > 0
      ? Math.max(
          ...validGrowthValues
        )
      : 0;


  const overallTop5 =
    [...guildMembers]
      .filter(
        member =>
          Number(
            member.growthPowerNumber || 0
          ) > 0
      )
      .sort(
        (a, b) =>
          b.growthPowerNumber -
          a.growthPowerNumber
      )
      .slice(0, 5);


  const rankingJobs =
    guildJobs.filter(Boolean);


  const selectedRankingJob =
    rankingJobs.length > 0
      ? rankingJobs[
          jobRankIndex %
            rankingJobs.length
        ]
      : "";


  const selectedJobTop5 =
    selectedRankingJob
      ? [...guildMembers]
          .filter(
            member =>
              member.job ===
                selectedRankingJob &&
              Number(
                member.growthPowerNumber || 0
              ) > 0
          )
          .sort(
            (a, b) =>
              b.growthPowerNumber -
              a.growthPowerNumber
          )
          .slice(0, 5)
      : [];


  const bossSchedule =
    bossTimers
      .map(
        (
          boss,
          index
        ) => {

          const fixed =
            boss.spawnType ===
            "fixed";


          if (
            fixed
          ) {

            const fixedInfo =
              getNextFixedTime(
                boss.fixedTimes ||
                []
              );


            if (
              !fixedInfo
            ) {
              return null;
            }


            return {
              boss: {
                ...boss,
                fixed: true,
                times:
                  boss.fixedTimes,
                cycle: "",
              },

              index,

              target:
                fixedInfo.target,

              spawn:
                fixedInfo.time,

              fixedInfo,
            };
          }


          if (
            !boss.nextSpawnAt
          ) {
            return null;
          }


          const target =
            new Date(
              boss.nextSpawnAt
            );


          if (
            Number.isNaN(
              target.getTime()
            )
          ) {
            return null;
          }


          return {
            boss: {
              ...boss,
              fixed: false,
              times: [],
              cycle:
                formatBossCycle(
                  boss.intervalMinutes
                ),
            },

            index,

            target,

            spawn:
              formatTimeOnly(
                target
              ),

            fixedInfo:
              null,
          };
        }
      )
      .filter(
        (
          item
        ): item is NonNullable<
          typeof item
        > =>
          item !== null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.target.getTime() -
          b.target.getTime()
      );



  return (

    <main className="dashboard">


      {/* =================================================
          TOP BAR
      ================================================= */}

      <AppTopBar />



      {/* =================================================
          MAIN GRID
      ================================================= */}

      <div
        className="dashboardGrid"
        id="dashboard"
      >


        {/* LEFT */}

        <section className="brandingPanel">


          <div className="brandText">

            <div className="smallTitle">
              APHRODITE 02
            </div>

            <h1>
              게임하는
              <br />
              밍쨩
            </h1>

            <p>
              핑뚝 · 빨뚝 · 검뚝
              <br />
              3개 길드 통합 관리 대시보드
            </p>

          </div>



          {/* NOTICE */}

          <section className="noticePanel">

            <div className="noticePanelHeader">

              <div>

                <span className="noticeEyebrow">
                  GUILD NOTICE
                </span>

                <h2>
                  📢 공지사항
                </h2>

              </div>

              <span className="noticeCountBadge">
                {notices.length}
              </span>

            </div>


            {
              noticesLoading &&
              (

                <div className="noticeEmpty">
                  공지사항을 불러오는 중...
                </div>

              )
            }


            {
              noticeError &&
              (

                <div className="noticeEmpty noticeError">
                  {noticeError}
                </div>

              )
            }


            {
              !noticesLoading &&
              !noticeError &&
              visibleNotices.length ===
                0 &&
              (

                <div className="noticeEmpty">
                  등록된 공지가 없습니다.
                </div>

              )
            }


            <div className="dashboardNoticeList">

              {
                visibleNotices.map(
                  notice => {

                    const opened =
                      openedNoticeId ===
                      notice.id;


                    return (

                      <button
                        key={
                          notice.id
                        }

                        className={
                          notice.is_pinned
                            ? "dashboardNoticeItem pinned"
                            : "dashboardNoticeItem"
                        }

                        onClick={
                          () =>
                            setOpenedNoticeId(
                              opened
                                ? null
                                : notice.id
                            )
                        }
                      >

                        <div className="dashboardNoticeTop">

                          <div className="dashboardNoticeTitle">

                            {
                              notice.is_pinned &&
                              (
                                <span>
                                  📌
                                </span>
                              )
                            }

                            <strong>
                              {notice.title}
                            </strong>

                          </div>


                          <span className="dashboardNoticeDate">

                            {
                              formatNoticeDate(
                                notice.created_at
                              )
                            }

                          </span>

                        </div>


                        {
                          opened &&
                          (

                            <div className="dashboardNoticeContent">
                              {notice.content}
                            </div>

                          )
                        }


                        <div className="dashboardNoticeBottom">

                          <span>
                            {
                              notice.created_by ||
                              "관리자"
                            }
                          </span>

                          <span>
                            {
                              opened
                                ? "접기 ↑"
                                : "내용 보기 ↓"
                            }
                          </span>

                        </div>

                      </button>

                    );
                  }
                )
              }

            </div>

          </section>



          {/* JOB RANKING */}

          <section className="jobRankingPanel">

            <div className="jobRankingHeader">

              <div>
                <span className="jobRankingEyebrow">
                  CLASS TOP 5
                </span>
                <h2>
                  🏆 직업별 성장력 TOP 5
                </h2>
              </div>

              <div className="jobRankingNav">
                <button
                  type="button"
                  aria-label="이전 직업"
                  disabled={
                    rankingJobs.length <= 1
                  }
                  onClick={
                    () =>
                      setJobRankIndex(
                        current =>
                          rankingJobs.length > 0
                            ? (
                                current -
                                1 +
                                rankingJobs.length
                              ) %
                              rankingJobs.length
                            : 0
                      )
                  }
                >
                  ‹
                </button>

                <button
                  type="button"
                  aria-label="다음 직업"
                  disabled={
                    rankingJobs.length <= 1
                  }
                  onClick={
                    () =>
                      setJobRankIndex(
                        current =>
                          rankingJobs.length > 0
                            ? (
                                current +
                                1
                              ) %
                              rankingJobs.length
                            : 0
                      )
                  }
                >
                  ›
                </button>
              </div>

            </div>


            <button
              type="button"
              className="jobRankingSelector"
              disabled={
                rankingJobs.length <= 1
              }
              onClick={
                () =>
                  setJobRankIndex(
                    current =>
                      rankingJobs.length > 0
                        ? (
                            current +
                            1
                          ) %
                          rankingJobs.length
                        : 0
                  )
              }
            >
              <strong>
                {
                  selectedRankingJob ||
                  "직업 데이터 없음"
                }
              </strong>
              <span>
                클릭해서 다음 직업 보기
              </span>
            </button>


            <div className="jobRankingList">

              {
                selectedJobTop5.map(
                  (
                    member,
                    index
                  ) => (
                    <div
                      className="jobRankingRow"
                      key={
                        `${member.gid}-${member.nickname}`
                      }
                    >
                      <span className="jobRankingPlace">
                        {index + 1}
                      </span>

                      <div className="jobRankingIdentity">
                        <strong>
                          {member.nickname}
                        </strong>
                        <small>
                          {member.guild}
                        </small>
                      </div>

                      <strong className="jobRankingPower">
                        {
                          member
                            .growthPowerNumber
                            .toLocaleString()
                        }
                      </strong>
                    </div>
                  )
                )
              }

              {
                !guildLoading &&
                selectedJobTop5.length ===
                  0 &&
                (
                  <div className="jobRankingEmpty">
                    표시할 성장력 데이터가 없습니다.
                  </div>
                )
              }

            </div>

          </section>



          {/* GUIDE */}

          <section
            className="guidePanel"
            id="guide"
          >

            <div className="guidePanelHeader">

              <div>

                <span className="guideEyebrow">
                  PERMANENT GUIDE
                </span>

                <h2>

                  <span className="guideCheck">
                    ✓
                  </span>

                  {
                    guide?.title ||
                    "안내사항"
                  }

                </h2>

              </div>

            </div>


            {
              guideLoading &&
              (

                <div className="guideEmpty">
                  안내사항을 불러오는 중...
                </div>

              )
            }


            {
              guideError &&
              (

                <div className="guideEmpty">
                  {guideError}
                </div>

              )
            }


            <div className="guideList">

              {
                guideLines.map(
                  (
                    line,
                    index
                  ) => (

                    <div
                      className="guideItem"

                      key={
                        index
                      }
                    >

                      <span className="guideBullet">
                        •
                      </span>

                      <p>
                        {line}
                      </p>

                    </div>

                  )
                )
              }

            </div>

          </section>


        </section>



        {/* =================================================
            CENTER DASHBOARD
        ================================================= */}

        <section className="dashboardCenter">

          <div className="insightGrid">

            <article className="insightCard">

              <div className="insightHeader">

                <div>
                  <span className="insightEyebrow">
                    JOB DISTRIBUTION
                  </span>

                  <h2>
                    ⚔️ 직업 분포
                  </h2>
                </div>

                <strong className="insightTotal">
                  {guildCounts.total}명
                </strong>

              </div>

              {
                guildLoading &&
                (
                  <div className="insightState">
                    길드 데이터를 불러오는 중...
                  </div>
                )
              }

              {
                !guildLoading &&
                guildError &&
                (
                  <div className="insightState error">
                    {guildError}
                  </div>
                )
              }

              {
                !guildLoading &&
                !guildError &&
                jobDistribution.length > 0 &&
                (
                  <div className="jobDistributionList">

                    {
                      jobDistribution.map(
                        item => (

                          <div
                            className="jobDistributionRow"
                            key={item.job}
                          >

                            <div className="jobDistributionMeta">
                              <strong>{item.job}</strong>
                              <span>{item.count}명</span>
                            </div>

                            <div className="chartTrack">
                              <span
                                className="chartFill"
                                style={{
                                  width:
                                    `${Math.max(
                                      6,
                                      (item.count /
                                        maxJobCount) *
                                        100
                                    )}%`,
                                }}
                              />
                            </div>

                          </div>

                        )
                      )
                    }

                  </div>
                )
              }

            </article>


            <article className="insightCard growthInsightCard">

              <div className="insightHeader">

                <div>
                  <span className="insightEyebrow">
                    GROWTH POWER
                  </span>

                  <h2>
                    📈 성장력 분포
                  </h2>
                </div>

                <div className="growthSummary">
                  <span>평균</span>
                  <strong>
                    {averageGrowth.toLocaleString()}
                  </strong>
                </div>

              </div>

              {
                !guildLoading &&
                !guildError &&
                growthBuckets.length > 0 &&
                (
                  <>

                    <div className="growthBars">

                      {
                        growthBuckets.map(
                          bucket => (

                            <div
                              className="growthBarItem"
                              key={`${bucket.min}-${bucket.max}`}
                            >

                              <div className="growthBarValue">
                                {bucket.count}
                              </div>

                              <div className="growthBarTrack">
                                <span
                                  style={{
                                    height:
                                      `${Math.max(
                                        10,
                                        (bucket.count /
                                          maxGrowthBucketCount) *
                                          100
                                      )}%`,
                                  }}
                                />
                              </div>

                              <small>
                                {bucket.label}
                              </small>

                            </div>

                          )
                        )
                      }

                    </div>

                    <div className="growthFooter">
                      <span>
                        최고 성장력
                      </span>
                      <strong>
                        {highestGrowth.toLocaleString()}
                      </strong>
                    </div>

                  </>
                )
              }

              {
                !guildLoading &&
                !guildError &&
                growthBuckets.length === 0 &&
                (
                  <div className="insightState">
                    성장력 데이터가 없습니다.
                  </div>
                )
              }

            </article>

          </div>


          <section className="overallRankingPanel">

            <div className="overallRankingHeader">
              <div>
                <span>
                  POWER RANKING
                </span>
                <h2>
                  👑 전체 성장력 TOP 5
                </h2>
              </div>

              <small>
                🧾길드현황 기준
              </small>
            </div>


            <div className="overallRankingGrid">

              {
                overallTop5.map(
                  (
                    member,
                    index
                  ) => (
                    <div
                      className={
                        index === 0
                          ? "overallRankCard first"
                          : "overallRankCard"
                      }
                      key={
                        `${member.gid}-${member.nickname}`
                      }
                    >
                      <span className="overallRankNumber">
                        {index + 1}
                      </span>

                      <div className="overallRankMember">
                        <strong>
                          {member.nickname}
                        </strong>
                        <small>
                          {member.job} · {member.guild}
                        </small>
                      </div>

                      <strong className="overallRankPower">
                        {
                          member
                            .growthPowerNumber
                            .toLocaleString()
                        }
                      </strong>
                    </div>
                  )
                )
              }

              {
                !guildLoading &&
                overallTop5.length ===
                  0 &&
                (
                  <div className="overallRankEmpty">
                    성장력 랭킹 데이터가 없습니다.
                  </div>
                )
              }

            </div>

          </section>


          <section
            className="bossPanel"
            id="boss"
          >

            <div className="panelTitle bossPanelTitle">

              <div>

                <h2>
                  ⏰ 실시간 보스타임
                </h2>

                <span className="bossPanelDescription">
                  밍봇과 실시간 연동된 보스타임입니다. 왼쪽은 소환 시각, 오른쪽은 남은시간과 다음 소환 일정을 표시합니다.
                </span>

              </div>


              <div className="bossClock">
                <span>현재시간</span>
                <strong>
                  {
                    now.toLocaleTimeString(
                      "ko-KR",
                      {
                        hour12: false,
                      }
                    )
                  }
                </strong>
              </div>

            </div>


            <div className="bossLegend">
              <span>소환 = 밍봇 기준 다음 소환 시각</span>
              <span>남은시간 = 실시간 카운트다운</span>
              <span>고정젠 = 등록된 고정시각 중 가장 가까운 시간</span>
            </div>


            <div className="bossList">

              {
                bossLoading &&
                (
                  <div className="bossDataState">
                    보스타임 연동 정보를 불러오는 중입니다.
                  </div>
                )
              }


              {
                !bossLoading &&
                bossError &&
                (
                  <div className="bossDataState bossDataError">
                    ⚠️ {bossError}
                  </div>
                )
              }


              {
                !bossLoading &&
                !bossError &&
                bossSchedule.length === 0 &&
                (
                  <div className="bossDataState">
                    등록된 다음 보스타임이 없습니다.
                  </div>
                )
              }


              {
                bossSchedule.map(
                  (
                    schedule,
                    scheduleIndex
                  ) => {

                    const {
                      boss,
                      target,
                      spawn,
                      fixedInfo,
                    } =
                      schedule;


                    const previousTarget =
                      scheduleIndex > 0
                        ? bossSchedule[
                            scheduleIndex -
                              1
                          ].target
                        : null;


                    const dateChanged =
                      previousTarget
                        ? (
                            previousTarget
                              .getFullYear() !==
                              target
                                .getFullYear() ||
                            previousTarget
                              .getMonth() !==
                              target
                                .getMonth() ||
                            previousTarget
                              .getDate() !==
                              target
                                .getDate()
                          )
                        : false;


                    const dateLabel =
                      target.toLocaleDateString(
                        "ko-KR",
                        {
                          month:
                            "2-digit",
                          day:
                            "2-digit",
                          weekday:
                            "short",
                        }
                      );


                    return (

                      <div
                        className="bossScheduleGroup"
                        key={
                          boss.id
                        }
                      >

                        {
                          dateChanged &&
                          (
                            <div className="bossDateDivider">
                              <span />
                              <strong>
                                🌙 날짜 변경 · {dateLabel}
                              </strong>
                              <span />
                            </div>
                          )
                        }


                        <div
                          className={
                            boss.fixed
                              ? "bossRow fixedBoss"
                              : "bossRow"
                          }
                        >

                          <div className="bossSpawnPrimary">
                            <span>소환</span>
                            <strong>
                              {spawn}
                            </strong>
                          </div>


                          <div className="bossMain">

                            <span className="bossIcon">
                              {
                                boss.fixed
                                  ? "🕒"
                                  : "⏰"
                              }
                            </span>

                            <div>

                              <strong>
                                {
                                  !boss.fixed &&
                                  (
                                    <>
                                      <span className="bossLevelInline">
                                        Lv.{boss.level}
                                      </span>
                                      {" "}
                                    </>
                                  )
                                }
                                {boss.name}
                              </strong>

                              <small
                                className={
                                  boss.fixed
                                    ? "bossCycleText fixedCycleText"
                                    : "bossCycleText"
                                }
                              >
                                {
                                  boss.fixed
                                    ? `고정젠 · 매일 ${boss.times?.join(" · ")}`
                                    : `젠 주기 · ${boss.cycle}`
                                }
                              </small>

                            </div>

                          </div>


                          <div className="bossTimerBlock">
                            <div className="bossTimerMetric">
                              <span>남은시간</span>
                              <strong>
                                {
                                  formatRemain(
                                    target
                                  )
                                }
                              </strong>
                            </div>

                            <div className="bossNextSpawn">
                              <span>다음 소환</span>
                              <strong>
                                {
                                  formatNextSpawn(
                                    fixedInfo
                                      ? fixedInfo.target
                                      : target
                                  )
                                }
                              </strong>
                            </div>
                          </div>

                        </div>

                      </div>

                    );
                  }
                )
              }

            </div>

          </section>

        </section>



        {/* =================================================
            DISTRIBUTION
        ================================================= */}

        <aside
          className="distributionPanel"
          id="distribution"
          style={{
            gridColumn:
              "1 / -1",
          }}
        >

          <div className="distributionHeader">
            💎 길드 전체 분배내역
          </div>


          <div className="distributionOverviewGrid">

            <div className="distributionOverviewCard">
              <span>전체 분배건수</span>
              <strong>
                {distributionRows.length.toLocaleString()}건
              </strong>
            </div>

            <div className="distributionOverviewCard">
              <span>현재 조회건수</span>
              <strong>
                {filteredDistributionRows.length.toLocaleString()}건
              </strong>
            </div>

            <div className="distributionOverviewCard">
              <span>조회 다이아</span>
              <strong>
                💎 {filteredDiamond.toLocaleString()}
              </strong>
            </div>

            <div className="distributionOverviewCard">
              <span>길드원 정보 연결</span>
              <strong>
                {linkedDistributionMembers.toLocaleString()}명
              </strong>
            </div>

          </div>


          <div className="distributionFilterBar">

            <label>
              <span>분류</span>
              <select
                value={category}
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
                  distributionCategories
                    .filter(
                      item =>
                        item !==
                        "전체"
                    )
                    .map(
                      item => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )
                }
              </select>
            </label>


            <label>
              <span>시작일</span>
              <input
                type="date"
                value={
                  distributionStartDate
                }
                onChange={
                  event =>
                    setDistributionStartDate(
                      event.target.value
                    )
                }
              />
            </label>


            <label>
              <span>종료일</span>
              <input
                type="date"
                value={
                  distributionEndDate
                }
                onChange={
                  event =>
                    setDistributionEndDate(
                      event.target.value
                    )
                }
              />
            </label>


            <label>
              <span>정렬</span>
              <select
                value={
                  distributionSort
                }
                onChange={
                  event =>
                    setDistributionSort(
                      event.target.value as
                        | "latest"
                        | "oldest"
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


            <button
              type="button"
              className="distributionResetButton"
              onClick={() => {
                setCategory(
                  "전체"
                );
                setDistributionStartDate(
                  ""
                );
                setDistributionEndDate(
                  ""
                );
                setDistributionSort(
                  "latest"
                );
              }}
            >
              초기화
            </button>

          </div>


          {
            distributionLoading &&
            (
              <div className="emptyResult">
                분배내역을 불러오는 중...
              </div>
            )
          }


          {
            !distributionLoading &&
            distributionMessage &&
            (
              <div className="emptyResult">
                {distributionMessage}
              </div>
            )
          }


          {
            !distributionLoading &&
            !distributionMessage &&
            filteredDistributionRows.length ===
              0 &&
            (
              <div className="emptyResult">
                조건에 맞는 분배내역이 없습니다.
              </div>
            )
          }


          {
            !distributionLoading &&
            !distributionMessage &&
            filteredDistributionRows.length >
              0 &&
            (
              <>

                <div className="distributionDesktopTable">

                  <div className="distributionDesktopHeader">
                    <span>날짜</span>
                    <span>아이템 / 분류</span>
                    <span>분배대상 / 길드원정보</span>
                    <span>다이아</span>
                  </div>


                  {
                    distributionPageRows.map(
                      row => (
                        <div
                          className="distributionDesktopRow"
                          key={`${row.rowNumber}-${row.date}-${row.target}-${row.item}`}
                        >
                          <span className="distributionDateCell">
                            {row.date || "-"}
                          </span>

                          <span className="distributionItemCell">
                            <strong>
                              {row.item || "-"}
                            </strong>
                            <small>
                              {row.category || "미분류"}
                              {row.itemJob
                                ? ` · ${row.itemJob}`
                                : ""}
                            </small>
                          </span>

                          <span className="distributionMemberCell">
                            <strong>
                              {row.target || "-"}
                            </strong>
                            <small>
                              {
                                row.member
                                  ? `${row.member.job || "직업미등록"} · 성장력 ${row.member.growthPower || "-"} · ${row.member.guild}`
                                  : "길드원 정보 미연결"
                              }
                            </small>
                          </span>

                          <span className="distributionDiamondCell">
                            💎 {Number(row.diamond || 0).toLocaleString()}
                          </span>
                        </div>
                      )
                    )
                  }

                </div>


                <div className="distributionMobileList">
                  {
                    distributionPageRows.map(
                      row => (
                        <article
                          className="distributionMobileCard"
                          key={`mobile-${row.rowNumber}-${row.date}-${row.target}-${row.item}`}
                        >
                          <div className="distributionMobileTop">
                            <span>
                              {row.date || "-"}
                            </span>
                            <strong>
                              💎 {Number(row.diamond || 0).toLocaleString()}
                            </strong>
                          </div>

                          <h3>
                            {row.item || "-"}
                          </h3>

                          <div className="distributionMobileTags">
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

                          <div className="distributionMobileMember">
                            <strong>
                              👤 {row.target || "-"}
                            </strong>
                            <small>
                              {
                                row.member
                                  ? `${row.member.job || "직업미등록"} · 성장력 ${row.member.growthPower || "-"} · ${row.member.guild}`
                                  : "길드원 정보 미연결"
                              }
                            </small>
                          </div>
                        </article>
                      )
                    )
                  }
                </div>


                <div className="distributionPagination">
                  <button
                    type="button"
                    disabled={
                      safeDistributionPage <=
                      1
                    }
                    onClick={() =>
                      setDistributionPage(
                        page =>
                          Math.max(
                            1,
                            page - 1
                          )
                      )
                    }
                  >
                    이전
                  </button>

                  <span>
                    {safeDistributionPage} / {distributionTotalPages}
                    {" · "}
                    {filteredDistributionRows.length.toLocaleString()}건
                  </span>

                  <button
                    type="button"
                    disabled={
                      safeDistributionPage >=
                      distributionTotalPages
                    }
                    onClick={() =>
                      setDistributionPage(
                        page =>
                          Math.min(
                            distributionTotalPages,
                            page + 1
                          )
                      )
                    }
                  >
                    다음
                  </button>
                </div>

              </>
            )
          }


          <style jsx>{`
            .distributionOverviewGrid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 10px;
              margin: 14px 0;
            }

            .distributionOverviewCard {
              display: flex;
              flex-direction: column;
              gap: 6px;
              padding: 14px;
              border: 1px solid rgba(255,255,255,.1);
              border-radius: 14px;
              background: rgba(255,255,255,.035);
            }

            .distributionOverviewCard span {
              font-size: 12px;
              color: #aaa;
            }

            .distributionOverviewCard strong {
              font-size: 18px;
              color: #f7f7f7;
            }

            .distributionFilterBar {
              display: grid;
              grid-template-columns: 1.2fr 1fr 1fr 1fr auto;
              gap: 10px;
              align-items: end;
              margin: 14px 0 16px;
            }

            .distributionFilterBar label {
              display: flex;
              flex-direction: column;
              gap: 6px;
              min-width: 0;
            }

            .distributionFilterBar label > span {
              font-size: 12px;
              color: #aaa;
            }

            .distributionFilterBar select,
            .distributionFilterBar input {
              width: 100%;
              min-height: 40px;
              padding: 0 11px;
              border: 1px solid rgba(255,255,255,.12);
              border-radius: 10px;
              background: rgba(255,255,255,.05);
              color: #f5f5f5;
            }

            .distributionFilterBar option {
              color: #111;
            }

            .distributionResetButton {
              min-height: 40px;
              padding: 0 15px;
              border: 1px solid rgba(255,255,255,.12);
              border-radius: 10px;
              background: rgba(255,255,255,.06);
              color: #f5f5f5;
              cursor: pointer;
            }

            .distributionDesktopTable {
              overflow: hidden;
              border: 1px solid rgba(255,255,255,.09);
              border-radius: 14px;
            }

            .distributionDesktopHeader,
            .distributionDesktopRow {
              display: grid;
              grid-template-columns: 110px minmax(190px, 1.1fr) minmax(260px, 1.5fr) 130px;
              align-items: center;
              gap: 12px;
              padding: 12px 14px;
            }

            .distributionDesktopHeader {
              background: rgba(255,255,255,.06);
              color: #aaa;
              font-size: 12px;
              font-weight: 700;
            }

            .distributionDesktopRow {
              border-top: 1px solid rgba(255,255,255,.07);
              color: #ddd;
            }

            .distributionItemCell,
            .distributionMemberCell {
              display: flex;
              flex-direction: column;
              gap: 4px;
              min-width: 0;
            }

            .distributionItemCell strong,
            .distributionMemberCell strong {
              color: #f7f7f7;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .distributionItemCell small,
            .distributionMemberCell small {
              color: #999;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .distributionDiamondCell {
              text-align: right;
              font-weight: 800;
              color: #fff;
            }

            .distributionMobileList {
              display: none;
            }

            .distributionPagination {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 12px;
              margin-top: 16px;
            }

            .distributionPagination button {
              min-width: 72px;
              min-height: 38px;
              border: 1px solid rgba(255,255,255,.12);
              border-radius: 10px;
              background: rgba(255,255,255,.06);
              color: #f5f5f5;
              cursor: pointer;
            }

            .distributionPagination button:disabled {
              opacity: .35;
              cursor: default;
            }

            .distributionPagination span {
              color: #aaa;
              font-size: 13px;
            }

            @media (max-width: 820px) {
              .distributionOverviewGrid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }

              .distributionFilterBar {
                grid-template-columns: 1fr 1fr;
              }

              .distributionResetButton {
                grid-column: 1 / -1;
              }

              .distributionDesktopTable {
                display: none;
              }

              .distributionMobileList {
                display: grid;
                gap: 10px;
              }

              .distributionMobileCard {
                padding: 14px;
                border: 1px solid rgba(255,255,255,.09);
                border-radius: 14px;
                background: rgba(255,255,255,.035);
              }

              .distributionMobileTop {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                color: #aaa;
                font-size: 12px;
              }

              .distributionMobileTop strong {
                color: #fff;
                font-size: 14px;
              }

              .distributionMobileCard h3 {
                margin: 10px 0 8px;
                color: #f7f7f7;
                font-size: 16px;
              }

              .distributionMobileTags {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
              }

              .distributionMobileTags span {
                padding: 4px 8px;
                border-radius: 999px;
                background: rgba(255,255,255,.07);
                color: #bbb;
                font-size: 11px;
              }

              .distributionMobileMember {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-top: 12px;
                padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,.07);
              }

              .distributionMobileMember strong {
                color: #f7f7f7;
              }

              .distributionMobileMember small {
                color: #999;
              }
            }

            @media (max-width: 520px) {
              .distributionOverviewGrid,
              .distributionFilterBar {
                grid-template-columns: 1fr;
              }

              .distributionResetButton {
                grid-column: auto;
              }

              .distributionPagination {
                gap: 8px;
              }

              .distributionPagination button {
                min-width: 62px;
              }
            }
          `}</style>

        </aside>



      </div>



      {/* =================================================
          GUILD STATUS
      ================================================= */}

      <section
        className="guildSection"
        id="guild"
      >

        <div className="guildSectionInner">


          <div className="guildSectionHeader">

            <div>

              <span className="guildSectionEyebrow">
                GUILD MEMBERS
              </span>


              <h2>
                👥 길드현황
              </h2>


              <p>
                핑뚝 · 빨뚝 · 검뚝 통합 길드원 현황
              </p>

            </div>


            <div className="guildTotalBadge">
              총 {guildCounts.total}명
            </div>

          </div>



          {/* 길드 필터 */}

          <div className="guildSummaryCards">


            <button
              className={
                guildFilter ===
                "전체"
                  ? "guildSummaryCard active"
                  : "guildSummaryCard"
              }

              onClick={
                () =>
                  setGuildFilter(
                    "전체"
                  )
              }
            >

              <span>
                전체
              </span>

              <strong>
                {guildCounts.total}
              </strong>

            </button>



            <button
              className={
                guildFilter ===
                "핑뚝"
                  ? "guildSummaryCard pink active"
                  : "guildSummaryCard pink"
              }

              onClick={
                () =>
                  setGuildFilter(
                    "핑뚝"
                  )
              }
            >

              <span>
                핑뚝
              </span>

              <strong>
                {guildCounts.pink}
              </strong>

            </button>



            <button
              className={
                guildFilter ===
                "빨뚝"
                  ? "guildSummaryCard red active"
                  : "guildSummaryCard red"
              }

              onClick={
                () =>
                  setGuildFilter(
                    "빨뚝"
                  )
              }
            >

              <span>
                빨뚝
              </span>

              <strong>
                {guildCounts.red}
              </strong>

            </button>



            <button
              className={
                guildFilter ===
                "검뚝"
                  ? "guildSummaryCard black active"
                  : "guildSummaryCard black"
              }

              onClick={
                () =>
                  setGuildFilter(
                    "검뚝"
                  )
              }
            >

              <span>
                검뚝
              </span>

              <strong>
                {guildCounts.black}
              </strong>

            </button>


          </div>



          {/* TOOLBAR */}

          <div className="guildToolbar">


            <div className="guildSearchBox">

              <span>
                🔍
              </span>

              <input
                value={
                  guildSearch
                }

                placeholder="닉네임 검색"

                onChange={
                  event =>
                    setGuildSearch(
                      event.target.value
                    )
                }
              />

            </div>



            <select
              className="guildJobSelect"

              value={
                jobFilter
              }

              onChange={
                event =>
                  setJobFilter(
                    event.target.value
                  )
              }
            >

              <option value="전체">
                전체 직업
              </option>


              {
                guildJobs.map(
                  job => (

                    <option
                      key={
                        job
                      }

                      value={
                        job
                      }
                    >
                      {job}
                    </option>

                  )
                )
              }

            </select>



            <select
              className="guildSortSelect"

              value={
                guildSort
              }

              onChange={
                event =>
                  setGuildSort(
                    event.target.value
                  )
              }
            >

              <option value="growthDesc">
                성장력 높은순
              </option>

              <option value="growthAsc">
                성장력 낮은순
              </option>

              <option value="nickname">
                닉네임 가나다순
              </option>

              <option value="attendanceDesc">
                참석률 높은순
              </option>

              <option value="participationDesc">
                참여횟수 높은순
              </option>

            </select>



            <select
              className="guildPageSizeSelect"

              value={
                pageSize
              }

              onChange={
                event =>
                  setPageSize(
                    Number(
                      event.target.value
                    )
                  )
              }
            >

              <option value={10}>
                10명씩
              </option>

              <option value={30}>
                30명씩
              </option>

              <option value={50}>
                50명씩
              </option>

            </select>



            <span className="guildFilteredCount">

              검색 결과{" "}

              {
                sortedGuildMembers.length
              }

              명

            </span>


          </div>



          {/* LOADING */}

          {
            guildLoading &&
            (

              <div className="guildLoading">
                길드현황을 불러오는 중...
              </div>

            )
          }



          {
            guildError &&
            (

              <div className="guildLoading guildError">
                {guildError}
              </div>

            )
          }



          {
            !guildLoading &&
            !guildError &&
            (

              <>

                <div className="guildTableWrap">


                  <div className="guildTableHeader">

                    <span>
                      순위
                    </span>

                    <span>
                      닉네임
                    </span>

                    <span>
                      직업
                    </span>

                    <span>
                      성장력
                    </span>

                    <span>
                      길드
                    </span>

                    <span>
                      참석률
                    </span>

                    <span>
                      참여
                    </span>

                  </div>



                  {
                    paginatedGuildMembers.map(
                      (
                        member,
                        index
                      ) => (

                        <div
                          className="guildTableRow"

                          key={
                            `${member.gid}-${member.nickname}`
                          }
                        >

                          <span className="guildRank">

                            {
                              startIndex +
                              index +
                              1
                            }

                          </span>


                          <strong className="guildNickname">
                            {member.nickname}
                          </strong>


                          <span>
                            {member.job}
                          </span>


                          <strong className="guildGrowth">

                            {
                              member.growthPower ||
                              "-"
                            }

                          </strong>


                          <span
                            className={
                              member.guild ===
                              "핑뚝"
                                ? "guildBadge pink"
                                : member.guild ===
                                  "빨뚝"
                                ? "guildBadge red"
                                : "guildBadge black"
                            }
                          >
                            {member.guild}
                          </span>


                          <span className="guildAttendance">

                            {
                              member.attendanceRate ||
                              "0%"
                            }

                          </span>


                          <span className="guildParticipation">

                            {
                              member.participationCount
                            }

                            {" / "}

                            {
                              member.targetCount
                            }

                          </span>

                        </div>

                      )
                    )
                  }



                  {
                    sortedGuildMembers.length ===
                      0 &&
                    (

                      <div className="guildNoResult">
                        조건에 맞는 길드원이 없습니다.
                      </div>

                    )
                  }


                </div>



                {/* PAGINATION */}

                {
                  sortedGuildMembers.length >
                    0 &&
                  (

                    <div className="guildPagination">


                      <div className="guildPaginationInfo">

                        <strong>
                          {
                            startIndex +
                            1
                          }
                        </strong>

                        <span>
                          -
                        </span>

                        <strong>

                          {
                            Math.min(
                              startIndex +
                              pageSize,

                              sortedGuildMembers.length
                            )
                          }

                        </strong>

                        <span>

                          / 총{" "}

                          {
                            sortedGuildMembers.length
                          }

                          명

                        </span>

                      </div>



                      <div className="guildPaginationControls">


                        <button
                          disabled={
                            safeCurrentPage <=
                            1
                          }

                          onClick={
                            () =>
                              setCurrentPage(
                                page =>
                                  Math.max(
                                    1,
                                    page - 1
                                  )
                              )
                          }
                        >
                          ← 이전
                        </button>



                        <div className="guildPageNumbers">

                          {
                            Array.from(
                              {
                                length:
                                  totalPages,
                              },

                              (
                                _,
                                index
                              ) =>
                                index + 1
                            ).map(
                              page => (

                                <button
                                  key={
                                    page
                                  }

                                  className={
                                    page ===
                                    safeCurrentPage
                                      ? "active"
                                      : ""
                                  }

                                  onClick={
                                    () =>
                                      setCurrentPage(
                                        page
                                      )
                                  }
                                >
                                  {page}
                                </button>

                              )
                            )
                          }

                        </div>



                        <button
                          disabled={
                            safeCurrentPage >=
                            totalPages
                          }

                          onClick={
                            () =>
                              setCurrentPage(
                                page =>
                                  Math.min(
                                    totalPages,
                                    page + 1
                                  )
                              )
                          }
                        >
                          다음 →
                        </button>


                      </div>


                    </div>

                  )
                }

              </>

            )
          }


        </div>

      </section>


    </main>

  );
}