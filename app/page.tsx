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


type DistributionUser = {
  nickname: string;
  job: string;
  growthPower: string;
  count: number;
  totalDiamond: number;

  items: Array<{
    date: string;
    item: string;
    category: string;
    job: string;
    diamond: number;
  }>;
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


type BossScheduleBoss =
  BossTimer & {
    fixed: boolean;
    times: string[];
    cycle: string;
  };


type BossScheduleItem = {
  boss: BossScheduleBoss;
  index: number;
  target: Date;
  spawnTarget: Date;
  spawn: string;
  nextTarget: Date | null;
  missed: boolean;
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


function getNextFixedTimes(
  times: string[],
  now: Date,
  count = 2
) {
  const validTimes =
    times
      .map(
        time => {
          const [
            hour,
            minute,
          ] =
            time
              .split(":")
              .map(Number);

          if (
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
          ) {
            return null;
          }

          return {
            time,
            hour,
            minute,
          };
        }
      )
      .filter(
        (
          item
        ): item is {
          time: string;
          hour: number;
          minute: number;
        } =>
          item !== null
      );


  if (
    validTimes.length === 0
  ) {
    return [];
  }


  const candidates: Array<{
    time: string;
    target: Date;
  }> = [];


  for (
    let dayOffset = 0;
    candidates.length < count &&
    dayOffset < 8;
    dayOffset++
  ) {

    for (
      const fixedTime of
      validTimes
    ) {

      const target =
        new Date(
          now
        );

      target.setDate(
        target.getDate() +
        dayOffset
      );

      target.setHours(
        fixedTime.hour,
        fixedTime.minute,
        0,
        0
      );


      if (
        target <= now
      ) {
        continue;
      }


      candidates.push({
        time:
          fixedTime.time,
        target,
      });
    }


    candidates.sort(
      (a, b) =>
        a.target.getTime() -
        b.target.getTime()
    );
  }


  return candidates
    .sort(
      (a, b) =>
        a.target.getTime() -
        b.target.getTime()
    )
    .slice(
      0,
      count
    );
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
    search,
    setSearch,
  ] =
    useState("");


  const [
    user,
    setUser,
  ] =
    useState<
      DistributionUser | null
    >(
      null
    );


  const [
    category,
    setCategory,
  ] =
    useState(
      "전체"
    );


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    candidates,
    setCandidates,
  ] =
    useState<string[]>(
      []
    );


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
     DISTRIBUTION SEARCH
  ===================================================== */

  async function searchUser(
    forcedName:
      | string
      | null = null
  ) {

    const nickname =
      forcedName ||
      search.trim();


    if (
      !nickname
    ) {

      setMessage(
        "닉네임을 입력해주세요."
      );

      return;
    }


    setLoading(
      true
    );

    setMessage("");

    setCandidates(
      []
    );


    try {

      const response =
        await fetch(
          `/api/distribution?nickname=${encodeURIComponent(
            nickname
          )}`,
          {
            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      if (
        data.multiple &&
        data.candidates
      ) {

        setUser(
          null
        );


        setCandidates(
          data.candidates
        );


        setMessage(
          "검색 결과가 여러 개 있습니다."
        );


        return;
      }


      if (
        !data.success
      ) {

        setUser(
          null
        );


        setMessage(
          data.message ||
          "검색 결과가 없습니다."
        );


        return;
      }


      setUser(
        data
      );


      setSearch(
        data.nickname
      );


      setCategory(
        "전체"
      );


      setMessage("");

    } catch (
      error
    ) {

      console.error(
        error
      );


      setUser(
        null
      );


      setMessage(
        "분배 정보를 불러오지 못했습니다."
      );

    } finally {

      setLoading(
        false
      );
    }
  }


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

  const filteredItems =
    !user
      ? []
      : category ===
        "전체"
      ? user.items
      : user.items.filter(
          item =>
            item.category ===
            category
        );


  const filteredDiamond =
    filteredItems.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.diamond ||
          0
        ),
      0
    );


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
      .flatMap<BossScheduleItem>(
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

            const fixedInfos =
              getNextFixedTimes(
                boss.fixedTimes ||
                  [],
                now,
                2
              );


            return fixedInfos.map(
              (
                fixedInfo,
                fixedIndex
              ) => {

                const followingInfo =
                  getNextFixedTimes(
                    boss.fixedTimes ||
                      [],
                    new Date(
                      fixedInfo.target.getTime() +
                        1000
                    ),
                    1
                  )[0] ||
                  null;


                return {
                  boss: {
                    ...boss,
                    fixed: true,
                    times:
                      boss.fixedTimes,
                    cycle: "",
                  },

                  index:
                    index *
                      10 +
                    fixedIndex,

                  target:
                    fixedInfo.target,

                  spawnTarget:
                    fixedInfo.target,

                  spawn:
                    fixedInfo.time,

                  nextTarget:
                    followingInfo
                      ?.target ||
                    null,

                  missed:
                    false,
                };
              }
            );
          }


          if (
            !boss.nextSpawnAt
          ) {
            return [];
          }


          const storedTarget =
            new Date(
              boss.nextSpawnAt
            );


          if (
            Number.isNaN(
              storedTarget.getTime()
            )
          ) {
            return [];
          }


          const intervalMinutes =
            Number(
              boss.intervalMinutes ||
              0
            );


          if (
            intervalMinutes <= 0
          ) {

            return [
              {
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

                target:
                  storedTarget,

                spawnTarget:
                  storedTarget,

                spawn:
                  formatTimeOnly(
                    storedTarget
                  ),

                nextTarget:
                  null,

                missed:
                  storedTarget <=
                    now,
              },
            ];
          }


          const intervalMs =
            intervalMinutes *
            60 *
            1000;


          if (
            storedTarget >
            now
          ) {

            const followingTarget =
              new Date(
                storedTarget.getTime() +
                intervalMs
              );


            return [
              {
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

                target:
                  storedTarget,

                spawnTarget:
                  storedTarget,

                spawn:
                  formatTimeOnly(
                    storedTarget
                  ),

                nextTarget:
                  followingTarget,

                missed:
                  false,
              },
            ];
          }


          let missedTarget =
            new Date(
              storedTarget
            );


          let upcomingTarget =
            new Date(
              storedTarget.getTime() +
              intervalMs
            );


          while (
            upcomingTarget <=
            now
          ) {

            missedTarget =
              new Date(
                upcomingTarget
              );

            upcomingTarget =
              new Date(
                upcomingTarget.getTime() +
                intervalMs
              );
          }


          return [
            {
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

              // 정렬과 남은시간은 "앞으로 올 다음 타임" 기준.
              target:
                upcomingTarget,

              // 화면의 소환시간은 마지막으로 지나간 미입력 타임.
              spawnTarget:
                missedTarget,

              spawn:
                formatTimeOnly(
                  missedTarget
                ),

              nextTarget:
                upcomingTarget,

              missed:
                true,
            },
          ];
        }
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



          {/* OVERALL POWER RANKING */}

          <section
            className="overallRankingPanel"
            style={{
              marginBottom: "14px",
            }}
          >

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


            <div
              className="overallRankingGrid"
              style={{
                gridTemplateColumns: "1fr",
              }}
            >

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

                      <strong
                        className="overallRankPower"
                        style={{
                          gridColumn: "auto",
                          alignSelf: "center",
                        }}
                      >
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
                      style={
                        index === 0
                          ? {
                              background:
                                "linear-gradient(145deg, rgba(255, 198, 82, .10), #111 58%)",
                              boxShadow:
                                "inset 0 0 0 1px rgba(255, 199, 87, .30)",
                              borderRadius:
                                "9px",
                            }
                          : undefined
                      }
                    >
                      <span
                        className="jobRankingPlace"
                        style={
                          index === 0
                            ? {
                                color:
                                  "#ffd978",
                              }
                            : undefined
                        }
                      >
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
                      nextTarget,
                      missed,
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
                          `${boss.id}-${target.toISOString()}`
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
                            <span>
                              {
                                missed
                                  ? "소환 · 미입력"
                                  : "소환"
                              }
                            </span>
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
                                  nextTarget
                                    ? formatNextSpawn(
                                        nextTarget
                                      )
                                    : "-"
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
        >

          <div className="distributionHeader">
            👤 개인 분배 조회
          </div>


          <div className="searchBox">

            <input
              value={
                search
              }

              placeholder="닉네임 입력"

              onChange={
                event =>
                  setSearch(
                    event.target.value
                  )
              }

              onKeyDown={
                event => {

                  if (
                    event.key ===
                    "Enter"
                  ) {
                    searchUser();
                  }

                }
              }
            />


            <button
              onClick={
                () =>
                  searchUser()
              }
            >
              🔍 조회
            </button>

          </div>


          {
            loading &&
            (

              <div className="emptyResult">
                조회 중...
              </div>

            )
          }


          {
            message &&
            (

              <div className="emptyResult">
                {message}
              </div>

            )
          }


          {
            candidates.map(
              name => (

                <button
                  className="candidateButton"

                  key={
                    name
                  }

                  onClick={
                    () =>
                      searchUser(
                        name
                      )
                  }
                >
                  👤 {name}
                </button>

              )
            )
          }


          {
            user &&
            (

              <>

                <div className="userCard">

                  <h3>
                    👤 {user.nickname}
                  </h3>


                  <div className="userMeta">

                    <div>

                      ⚔️ 직업

                      <strong>
                        {user.job}
                      </strong>

                    </div>


                    <div>

                      📈 성장력

                      <strong>
                        {user.growthPower}
                      </strong>

                    </div>

                  </div>


                  <div className="userStats">

                    <div>

                      <span>
                        총 분배
                      </span>

                      <strong>
                        {user.count}건
                      </strong>

                    </div>


                    <div>

                      <span>
                        💎 다이아
                      </span>

                      <strong>

                        {
                          Number(
                            user.totalDiamond
                          ).toLocaleString()
                        }

                      </strong>

                    </div>

                  </div>

                </div>



                <div className="categoryList">

                  {
                    categories.map(
                      item => {

                        const count =
                          item ===
                          "전체"
                            ? user.items.length
                            : user.items.filter(
                                x =>
                                  x.category ===
                                  item
                              ).length;


                        return (

                          <button
                            key={
                              item
                            }

                            className={
                              category ===
                              item
                                ? "category active"
                                : "category"
                            }

                            onClick={
                              () =>
                                setCategory(
                                  item
                                )
                            }
                          >

                            {item}

                            <span>
                              {count}
                            </span>

                          </button>

                        );
                      }
                    )
                  }

                </div>



                <div className="distributionSummary">

                  <strong>
                    {category}
                  </strong>

                  <span>
                    {filteredItems.length}건
                  </span>

                  <span>

                    💎{" "}

                    {
                      filteredDiamond.toLocaleString()
                    }

                  </span>

                </div>



                <div className="distributionTable">

                  <div className="tableHeader">

                    <span>
                      날짜
                    </span>

                    <span>
                      아이템
                    </span>

                    <span>
                      직업
                    </span>

                    <span>
                      다이아
                    </span>

                  </div>


                  {
                    filteredItems.map(
                      (
                        item,
                        index
                      ) => (

                        <div
                          className="tableRow"

                          key={
                            index
                          }
                        >

                          <span>
                            {item.date}
                          </span>

                          <span>
                            {item.item}
                          </span>

                          <span>
                            {item.job}
                          </span>

                          <span>

                            {
                              Number(
                                item.diamond
                              ).toLocaleString()
                            }

                          </span>

                        </div>

                      )
                    )
                  }

                </div>

              </>

            )
          }

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