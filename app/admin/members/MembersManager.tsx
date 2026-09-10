"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import styles from "./members.module.css";


type GuildMember = {
  no: string;
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


type Props = {
  currentUser: string;
  isMaster: boolean;
};


type DiscordLinkCount = {
  gid: string;
  count: number;
  max: number;
  primaryCount: number;
  additionalCount: number;
  full: boolean;
};


type DiscordLink = {
  id: string;
  gid: string;
  discordId: string;
  discordUsername: string;
  discordDisplayName: string;
  accountType:
    | "primary"
    | "sub"
    | "discord_alt";
  createdAt: string;
  updatedAt: string;
};


function accountTypeLabel(
  type: DiscordLink["accountType"]
) {
  if (type === "primary") {
    return "본계정";
  }

  if (type === "sub") {
    return "부주";
  }

  return "디코부계정";
}


function parsePercent(
  value: string
) {
  return (
    Number(
      String(value || "0")
        .replace("%", "")
        .replace(",", "")
        .trim()
    ) || 0
  );
}


export default function MembersManager({
  currentUser,
  isMaster,
}: Props) {

  const [members, setMembers] =
    useState<GuildMember[]>([]);

  const [counts, setCounts] =
    useState<GuildCounts>({
      total: 0,
      pink: 0,
      red: 0,
      black: 0,
    });

  const [jobs, setJobs] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [guildFilter, setGuildFilter] =
    useState("전체");

  const [jobFilter, setJobFilter] =
    useState("전체");

  const [sort, setSort] =
    useState("growthDesc");

  const [pageSize, setPageSize] =
    useState(30);

  const [currentPage, setCurrentPage] =
    useState(1);


  /* =====================================================
     ADD / EDIT
  ===================================================== */

  const [formMode, setFormMode] =
    useState<"add" | "edit" | null>(
      null
    );

  const [editingMember, setEditingMember] =
    useState<GuildMember | null>(
      null
    );

  const [formNickname, setFormNickname] =
    useState("");

  const [formJob, setFormJob] =
    useState("");

  const [formGrowth, setFormGrowth] =
    useState("");

  const [formGuild, setFormGuild] =
    useState("핑뚝");

  const [saving, setSaving] =
    useState(false);

  const [formError, setFormError] =
    useState("");


  /* =====================================================
     LEAVE
  ===================================================== */

  const [
    deletingMember,
    setDeletingMember,
  ] =
    useState<GuildMember | null>(
      null
    );

  const [
    deleteConfirm,
    setDeleteConfirm,
  ] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const [
    deleteError,
    setDeleteError,
  ] =
    useState("");


  /* =====================================================
     DISCORD LINK MANAGEMENT
  ===================================================== */

  const [
    discordLinkCounts,
    setDiscordLinkCounts,
  ] =
    useState<Record<string, DiscordLinkCount>>(
      {}
    );

  const [
    linkManagingMember,
    setLinkManagingMember,
  ] =
    useState<GuildMember | null>(
      null
    );

  const [
    discordLinks,
    setDiscordLinks,
  ] =
    useState<DiscordLink[]>([]);

  const [
    linkLoading,
    setLinkLoading,
  ] =
    useState(false);

  const [
    linkError,
    setLinkError,
  ] =
    useState("");

  const [
    unlinkingDiscordId,
    setUnlinkingDiscordId,
  ] =
    useState("");


  /* =====================================================
     LOAD
  ===================================================== */

  async function loadMembers() {

    setLoading(true);
    setError("");

    try {

      const response =
        await fetch(
          "/api/guild",
          {
            cache: "no-store",
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
          "길드원 정보를 불러오지 못했습니다."
        );
      }

      setMembers(
        data.members || []
      );

      setCounts(
        data.counts || {
          total: 0,
          pink: 0,
          red: 0,
          black: 0,
        }
      );

      setJobs(
        data.jobs || []
      );

    } catch (err) {

      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "길드원 정보를 불러오지 못했습니다."
      );

    } finally {

      setLoading(false);
    }
  }


  async function loadDiscordLinkCounts() {

    try {

      const response =
        await fetch(
          "/api/admin/members/discord-links",
          {
            cache: "no-store",
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
          "Discord 연결상태를 불러오지 못했습니다."
        );
      }

      const next:
        Record<string, DiscordLinkCount> =
          {};

      for (
        const row of
        Array.isArray(data.counts)
          ? data.counts
          : []
      ) {

        const gid =
          String(
            row.gid || ""
          ).trim();

        if (!gid) {
          continue;
        }

        next[gid] = {
          gid,
          count:
            Number(
              row.count || 0
            ),
          max:
            Number(
              row.max || 2
            ),
          primaryCount:
            Number(
              row.primaryCount || 0
            ),
          additionalCount:
            Number(
              row.additionalCount || 0
            ),
          full:
            Boolean(
              row.full
            ),
        };
      }

      setDiscordLinkCounts(
        next
      );

    } catch (err) {

      console.error(
        "[Discord 연결상태]",
        err
      );
    }
  }


  async function loadDiscordLinks(
    gid: string
  ) {

    setLinkLoading(true);
    setLinkError("");

    try {

      const response =
        await fetch(
          `/api/admin/members/discord-links?gid=${encodeURIComponent(
            gid
          )}`,
          {
            cache: "no-store",
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
          "Discord 연결정보를 불러오지 못했습니다."
        );
      }

      setDiscordLinks(
        Array.isArray(
          data.links
        )
          ? data.links
          : []
      );

    } catch (err) {

      console.error(err);

      setLinkError(
        err instanceof Error
          ? err.message
          : "Discord 연결정보를 불러오지 못했습니다."
      );

    } finally {

      setLinkLoading(false);
    }
  }


  function openDiscordLinks(
    member: GuildMember
  ) {

    setLinkManagingMember(
      member
    );

    setDiscordLinks([]);

    setLinkError("");

    loadDiscordLinks(
      member.gid
    );
  }


  function closeDiscordLinks() {

    if (unlinkingDiscordId) {
      return;
    }

    setLinkManagingMember(null);

    setDiscordLinks([]);

    setLinkError("");
  }


  async function unlinkDiscordAccount(
    link: DiscordLink
  ) {

    if (
      !linkManagingMember
    ) {
      return;
    }

    const displayName =
      link.discordDisplayName ||
      link.discordUsername ||
      link.discordId;

    const confirmed =
      window.confirm(
        `${linkManagingMember.nickname}님의 Discord 연결을 해제할까요?\n\n` +
        `${displayName} · ${accountTypeLabel(
          link.accountType
        )}\n\n` +
        "연결 해제 후 이 Discord 계정은 길드원 매핑이 없는 상태가 됩니다."
      );

    if (!confirmed) {
      return;
    }

    setUnlinkingDiscordId(
      link.discordId
    );

    setLinkError("");

    try {

      const response =
        await fetch(
          "/api/admin/members/discord-links",
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                discordId:
                  link.discordId,
              }),
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
          "Discord 연결 해제에 실패했습니다."
        );
      }

      await Promise.all([
        loadDiscordLinks(
          linkManagingMember.gid
        ),
        loadDiscordLinkCounts(),
      ]);

    } catch (err) {

      console.error(err);

      setLinkError(
        err instanceof Error
          ? err.message
          : "Discord 연결을 해제하지 못했습니다."
      );

    } finally {

      setUnlinkingDiscordId("");
    }
  }


  async function refreshAll() {

    await Promise.all([
      loadMembers(),
      loadDiscordLinkCounts(),
    ]);
  }


  useEffect(() => {

    refreshAll();

  }, []);


  useEffect(() => {

    setCurrentPage(1);

  }, [
    search,
    guildFilter,
    jobFilter,
    sort,
    pageSize,
  ]);


  /* =====================================================
     ADD
  ===================================================== */

  function openAdd() {

    setFormMode("add");

    setEditingMember(null);

    setFormNickname("");

    setFormJob("");

    setFormGrowth("");

    if (
      guildFilter === "핑뚝" ||
      guildFilter === "빨뚝" ||
      guildFilter === "검뚝"
    ) {
      setFormGuild(
        guildFilter
      );
    } else {
      setFormGuild(
        "핑뚝"
      );
    }

    setFormError("");
  }


  /* =====================================================
     EDIT
  ===================================================== */

  function openEdit(
    member: GuildMember
  ) {

    setFormMode("edit");

    setEditingMember(
      member
    );

    setFormNickname(
      member.nickname
    );

    setFormJob(
      member.job
    );

    setFormGrowth(
      String(
        member.growthPowerNumber
      )
    );

    setFormGuild(
      member.guild
    );

    setFormError("");
  }


  function closeForm() {

    if (saving) {
      return;
    }

    setFormMode(null);

    setEditingMember(null);

    setFormError("");
  }


  /* =====================================================
     SAVE
  ===================================================== */

  async function saveForm() {

    if (!formMode) {
      return;
    }

    const nickname =
      formNickname.trim();

    const job =
      formJob.trim();

    const growth =
      formGrowth
        .replace(/,/g, "")
        .trim();

    if (!nickname) {

      setFormError(
        "닉네임을 입력해주세요."
      );

      return;
    }

    if (!job) {

      setFormError(
        "직업을 입력해주세요."
      );

      return;
    }

    if (
      !/^\d+$/.test(
        growth
      )
    ) {

      setFormError(
        "성장력은 숫자로 입력해주세요."
      );

      return;
    }

    setSaving(true);

    setFormError("");

    try {

      const isAdd =
        formMode === "add";

      const url =
        isAdd
          ? "/api/admin/members"
          : `/api/admin/members/${encodeURIComponent(
              editingMember?.gid || ""
            )}`;

      const response =
        await fetch(
          url,
          {
            method:
              isAdd
                ? "POST"
                : "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                nickname,
                job,
                growthPower:
                  growth,
                guild:
                  formGuild,
              }),
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
          (
            isAdd
              ? "길드원 추가에 실패했습니다."
              : "길드원 수정에 실패했습니다."
          )
        );
      }

      await loadMembers();

      setFormMode(null);

      setEditingMember(null);

    } catch (err) {

      console.error(err);

      setFormError(
        err instanceof Error
          ? err.message
          : "저장하지 못했습니다."
      );

    } finally {

      setSaving(false);
    }
  }


  /* =====================================================
     LEAVE
  ===================================================== */

  function openDelete(
    member: GuildMember
  ) {

    setDeletingMember(
      member
    );

    setDeleteConfirm("");

    setDeleteError("");
  }


  function closeDelete() {

    if (deleting) {
      return;
    }

    setDeletingMember(null);

    setDeleteConfirm("");

    setDeleteError("");
  }


  async function deleteMember() {

    if (
      !deletingMember
    ) {
      return;
    }

    if (
      deleteConfirm.trim() !==
      deletingMember.nickname
    ) {

      setDeleteError(
        "탈퇴 처리할 길드원의 닉네임을 정확히 입력해주세요."
      );

      return;
    }

    setDeleting(true);

    setDeleteError("");

    try {

      const response =
        await fetch(
          `/api/admin/members/${encodeURIComponent(
            deletingMember.gid
          )}`,
          {
            method: "DELETE",
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
          "길드원 탈퇴처리에 실패했습니다."
        );
      }

      if (
        data.warning
      ) {
        window.alert(
          `탈퇴처리는 완료됐지만 확인할 항목이 있습니다.\n\n${data.warning}`
        );
      }

      await refreshAll();

      setDeletingMember(null);

      setDeleteConfirm("");

    } catch (err) {

      console.error(err);

      setDeleteError(
        err instanceof Error
          ? err.message
          : "길드원 탈퇴처리를 완료하지 못했습니다."
      );

    } finally {

      setDeleting(false);
    }
  }


  /* =====================================================
     FILTER
  ===================================================== */

  const keyword =
    search
      .trim()
      .toLowerCase();

  const filteredMembers =
    members.filter(
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
     SORT
  ===================================================== */

  const sortedMembers =
    [
      ...filteredMembers,
    ].sort(
      (a, b) => {

        if (
          sort ===
          "growthDesc"
        ) {
          return (
            b.growthPowerNumber -
            a.growthPowerNumber
          );
        }

        if (
          sort ===
          "growthAsc"
        ) {
          return (
            a.growthPowerNumber -
            b.growthPowerNumber
          );
        }

        if (
          sort ===
          "nickname"
        ) {
          return a.nickname.localeCompare(
            b.nickname,
            "ko"
          );
        }

        if (
          sort ===
          "attendance"
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
          sort ===
          "participation"
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
        sortedMembers.length /
        pageSize
      )
    );

  const safePage =
    Math.min(
      currentPage,
      totalPages
    );

  const startIndex =
    (
      safePage -
      1
    ) *
    pageSize;

  const visibleMembers =
    sortedMembers.slice(
      startIndex,
      startIndex +
        pageSize
    );


  return (

    <main className={styles.page}>

      <div className={styles.shell}>


        <header className={styles.header}>

          <div>

            <Link
              href="/admin"
              className={styles.brand}
            >
              ⚡ 게임하는밍쨩
            </Link>

            <div className={styles.server}>
              아프로디테 2 · 핑뚝 / 빨뚝 / 검뚝
            </div>

          </div>


          <div className={styles.headerCenter}>
            Member Management
          </div>


          <div className={styles.headerRight}>

            <span>
              {currentUser}
            </span>

            <strong
              className={
                isMaster
                  ? styles.master
                  : styles.admin
              }
            >
              {
                isMaster
                  ? "MASTER"
                  : "ADMIN"
              }
            </strong>

          </div>

        </header>



        <div className={styles.content}>


          <section className={styles.titleSection}>

            <div>

              <div className={styles.eyebrow}>
                GUILD MEMBER MANAGEMENT
              </div>

              <h1>
                길드원 관리
              </h1>

              <p>
                핑뚝 · 빨뚝 · 검뚝 길드원을 추가, 수정, 탈퇴처리합니다.
              </p>

            </div>


            <div className={styles.titleActions}>

              <button
                className={styles.addButton}
                onClick={
                  openAdd
                }
              >
                + 길드원 추가
              </button>


              <button
                className={styles.refreshButton}
                onClick={
                  refreshAll
                }
                disabled={
                  loading
                }
              >
                ↻ 새로고침
              </button>


              <Link
                href="/admin"
                className={styles.backButton}
              >
                ← 관리자 홈
              </Link>

            </div>

          </section>



          <section className={styles.summaryGrid}>

            <button
              className={
                guildFilter ===
                "전체"
                  ? `${styles.summaryCard} ${styles.activeCard}`
                  : styles.summaryCard
              }
              onClick={
                () =>
                  setGuildFilter(
                    "전체"
                  )
              }
            >
              <span>전체</span>
              <strong>{counts.total}</strong>
              <small>TOTAL MEMBERS</small>
            </button>


            <button
              className={
                guildFilter ===
                "핑뚝"
                  ? `${styles.summaryCard} ${styles.pinkCard} ${styles.activeCard}`
                  : `${styles.summaryCard} ${styles.pinkCard}`
              }
              onClick={
                () =>
                  setGuildFilter(
                    "핑뚝"
                  )
              }
            >
              <span>핑뚝</span>
              <strong>{counts.pink}</strong>
              <small>PINK</small>
            </button>


            <button
              className={
                guildFilter ===
                "빨뚝"
                  ? `${styles.summaryCard} ${styles.redCard} ${styles.activeCard}`
                  : `${styles.summaryCard} ${styles.redCard}`
              }
              onClick={
                () =>
                  setGuildFilter(
                    "빨뚝"
                  )
              }
            >
              <span>빨뚝</span>
              <strong>{counts.red}</strong>
              <small>RED</small>
            </button>


            <button
              className={
                guildFilter ===
                "검뚝"
                  ? `${styles.summaryCard} ${styles.blackCard} ${styles.activeCard}`
                  : `${styles.summaryCard} ${styles.blackCard}`
              }
              onClick={
                () =>
                  setGuildFilter(
                    "검뚝"
                  )
              }
            >
              <span>검뚝</span>
              <strong>{counts.black}</strong>
              <small>BLACK</small>
            </button>

          </section>



          <section className={styles.toolbar}>

            <div className={styles.searchBox}>

              <span>
                🔍
              </span>

              <input
                value={
                  search
                }
                placeholder="닉네임 검색"
                onChange={
                  event =>
                    setSearch(
                      event.target.value
                    )
                }
              />

            </div>


            <select
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
                jobs.map(
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
              value={
                sort
              }
              onChange={
                event =>
                  setSort(
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

              <option value="attendance">
                참석률 높은순
              </option>

              <option value="participation">
                참여횟수 높은순
              </option>

            </select>


            <select
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


            <div className={styles.resultCount}>
              검색 결과
              <strong>
                {sortedMembers.length}
              </strong>
              명
            </div>

          </section>



          {
            loading &&
            (
              <div className={styles.stateBox}>
                길드원 정보를 불러오는 중...
              </div>
            )
          }


          {
            error &&
            !loading &&
            (
              <div
                className={
                  `${styles.stateBox} ${styles.errorBox}`
                }
              >
                {error}
              </div>
            )
          }


          {
            !loading &&
            !error &&
            (

              <>

                <section className={styles.tableWrap}>

                  <div className={styles.tableHeader}>

                    <span>NO</span>
                    <span>GID</span>
                    <span>닉네임</span>
                    <span>직업</span>
                    <span>성장력</span>
                    <span>길드</span>
                    <span>참석률</span>
                    <span>참여</span>
                    <span>디스코드</span>
                    <span>관리</span>

                  </div>


                  {
                    visibleMembers.map(
                      (
                        member
                      ) => (

                        <div
                          className={styles.tableRow}
                          key={
                            `${member.gid}-${member.nickname}`
                          }
                        >

                          <span className={styles.rank}>
                            {
                              member.no ||
                              "-"
                            }
                          </span>

                          <span className={styles.gid}>
                            {
                              member.gid ||
                              "-"
                            }
                          </span>

                          <strong className={styles.nickname}>
                            {member.nickname}
                          </strong>

                          <span>
                            {member.job || "-"}
                          </span>

                          <strong className={styles.growth}>
                            {member.growthPower || "-"}
                          </strong>

                          <span
                            className={
                              member.guild ===
                              "핑뚝"
                                ? `${styles.guildBadge} ${styles.pink}`
                                : member.guild ===
                                  "빨뚝"
                                ? `${styles.guildBadge} ${styles.red}`
                                : `${styles.guildBadge} ${styles.black}`
                            }
                          >
                            {member.guild}
                          </span>

                          <span className={styles.attendance}>
                            {
                              member.attendanceRate ||
                              "0%"
                            }
                          </span>

                          <span className={styles.participation}>
                            {member.participationCount}
                            {" / "}
                            {member.targetCount}
                          </span>

                          <div className={styles.discordCell}>

                            <span
                              className={
                                (discordLinkCounts[
                                  member.gid
                                ]?.count || 0) >= 2
                                  ? `${styles.linkBadge} ${styles.linkFull}`
                                  : (discordLinkCounts[
                                      member.gid
                                    ]?.count || 0) === 1
                                  ? `${styles.linkBadge} ${styles.linkPartial}`
                                  : styles.linkBadge
                              }
                            >
                              🔗 {
                                discordLinkCounts[
                                  member.gid
                                ]?.count || 0
                              }/2
                            </span>

                            <button
                              className={styles.linkManageButton}
                              onClick={
                                () =>
                                  openDiscordLinks(
                                    member
                                  )
                              }
                            >
                              연결관리
                            </button>

                          </div>

                          <div className={styles.rowActions}>

                            <button
                              className={styles.editButton}
                              onClick={
                                () =>
                                  openEdit(
                                    member
                                  )
                              }
                            >
                              수정
                            </button>

                            <button
                              className={styles.deleteButton}
                              onClick={
                                () =>
                                  openDelete(
                                    member
                                  )
                              }
                            >
                              탈퇴
                            </button>

                          </div>

                        </div>

                      )
                    )
                  }


                  {
                    sortedMembers.length === 0 &&
                    (
                      <div className={styles.emptyResult}>
                        조건에 맞는 길드원이 없습니다.
                      </div>
                    )
                  }

                </section>


                {
                  sortedMembers.length > 0 &&
                  (

                    <section className={styles.pagination}>

                      <div className={styles.pageInfo}>

                        <strong>
                          {startIndex + 1}
                        </strong>

                        <span>-</span>

                        <strong>
                          {
                            Math.min(
                              startIndex +
                              pageSize,
                              sortedMembers.length
                            )
                          }
                        </strong>

                        <span>
                          / 총 {sortedMembers.length}명
                        </span>

                      </div>


                      <div className={styles.pageControls}>

                        <button
                          disabled={
                            safePage <= 1
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


                        <div className={styles.pageNumbers}>

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
                                  key={page}
                                  className={
                                    page ===
                                    safePage
                                      ? styles.activePage
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
                            safePage >=
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

                    </section>

                  )
                }

              </>

            )
          }

        </div>

      </div>


      {/* ADD / EDIT MODAL */}

      {
        formMode &&
        (

          <div className={styles.modalBackdrop}>

            <div className={styles.modal}>

              <div className={styles.modalHeader}>

                <div>

                  <span>
                    {
                      formMode === "add"
                        ? "MEMBER CREATE"
                        : "MEMBER EDIT"
                    }
                  </span>

                  <h2>
                    {
                      formMode === "add"
                        ? "길드원 추가"
                        : "길드원 정보 수정"
                    }
                  </h2>

                </div>


                <button
                  className={styles.modalClose}
                  onClick={closeForm}
                >
                  ×
                </button>

              </div>


              {
                formMode ===
                  "edit" &&
                editingMember &&
                (

                  <div className={styles.memberIdentity}>

                    <span>GID</span>

                    <strong>
                      {editingMember.gid}
                    </strong>

                  </div>

                )
              }


              {
                formMode === "add" &&
                (

                  <div className={styles.newMemberInfo}>
                    새 길드원의 GID는 저장 시 자동으로 발급됩니다.
                  </div>

                )
              }


              <div className={styles.editForm}>

                <label>

                  <span>
                    닉네임
                  </span>

                  <input
                    value={formNickname}
                    placeholder="인게임 닉네임"
                    onChange={
                      event =>
                        setFormNickname(
                          event.target.value
                        )
                    }
                  />

                </label>


                <label>

                  <span>
                    직업
                  </span>

                  <input
                    list="memberJobList"
                    value={formJob}
                    placeholder="직업"
                    onChange={
                      event =>
                        setFormJob(
                          event.target.value
                        )
                    }
                  />

                  <datalist id="memberJobList">

                    {
                      jobs.map(
                        job => (
                          <option
                            key={job}
                            value={job}
                          />
                        )
                      )
                    }

                  </datalist>

                </label>


                <label>

                  <span>
                    성장력
                  </span>

                  <input
                    inputMode="numeric"
                    value={formGrowth}
                    placeholder="예: 86941"
                    onChange={
                      event =>
                        setFormGrowth(
                          event.target.value
                        )
                    }
                  />

                </label>


                <label>

                  <span>
                    길드
                  </span>

                  <select
                    value={formGuild}
                    onChange={
                      event =>
                        setFormGuild(
                          event.target.value
                        )
                    }
                  >

                    <option value="핑뚝">
                      핑뚝
                    </option>

                    <option value="빨뚝">
                      빨뚝
                    </option>

                    <option value="검뚝">
                      검뚝
                    </option>

                  </select>

                </label>

              </div>


              {
                formError &&
                (
                  <div className={styles.saveError}>
                    ! {formError}
                  </div>
                )
              }


              <div className={styles.modalActions}>

                <button
                  className={styles.cancelEditButton}
                  onClick={closeForm}
                  disabled={saving}
                >
                  취소
                </button>

                <button
                  className={styles.saveEditButton}
                  onClick={saveForm}
                  disabled={saving}
                >
                  {
                    saving
                      ? "저장 중..."
                      : formMode === "add"
                      ? "길드원 추가"
                      : "변경사항 저장"
                  }
                </button>

              </div>

            </div>

          </div>

        )
      }


      {/* LEAVE MODAL */}

      {
        deletingMember &&
        (

          <div className={styles.modalBackdrop}>

            <div
              className={
                `${styles.modal} ${styles.deleteModal}`
              }
            >

              <div className={styles.modalHeader}>

                <div>

                  <span>
                    MEMBER LEAVE
                  </span>

                  <h2>
                    길드원 탈퇴처리
                  </h2>

                </div>


                <button
                  className={styles.modalClose}
                  onClick={closeDelete}
                >
                  ×
                </button>

              </div>


              <div className={styles.deleteWarning}>

                <strong>
                  {deletingMember.nickname}
                </strong>

                <p>
                  이 캐릭터를 탈퇴 상태로 변경합니다.
                  <br />
                  캐릭터 정보와 과거 참여·분배 기록은 삭제하지 않습니다.
                  {
                    (discordLinkCounts[deletingMember.gid]?.count || 0) > 0 &&
                    <>
                      <br />
                      연결된 Discord 계정 {discordLinkCounts[deletingMember.gid]?.count || 0}개의 제우스 역할을 회수하고 밍보드 접근을 차단합니다.
                    </>
                  }
                </p>

              </div>


              <label className={styles.deleteConfirmField}>

                <span>
                  탈퇴 확인을 위해 닉네임을 그대로 입력하세요.
                </span>

                <input
                  value={deleteConfirm}
                  placeholder={
                    deletingMember.nickname
                  }
                  onChange={
                    event =>
                      setDeleteConfirm(
                        event.target.value
                      )
                  }
                />

              </label>


              {
                deleteError &&
                (
                  <div className={styles.saveError}>
                    ! {deleteError}
                  </div>
                )
              }


              <div className={styles.modalActions}>

                <button
                  className={styles.cancelEditButton}
                  onClick={closeDelete}
                  disabled={deleting}
                >
                  취소
                </button>

                <button
                  className={styles.confirmDeleteButton}
                  onClick={deleteMember}
                  disabled={
                    deleting ||
                    deleteConfirm.trim() !==
                    deletingMember.nickname
                  }
                >
                  {
                    deleting
                      ? "탈퇴처리 중..."
                      : "탈퇴처리"
                  }
                </button>

              </div>

            </div>

          </div>

        )
      }


      {/* DISCORD LINK MANAGEMENT MODAL */}

      {
        linkManagingMember &&
        (

          <div className={styles.modalBackdrop}>

            <div
              className={
                `${styles.modal} ${styles.discordModal}`
              }
            >

              <div className={styles.modalHeader}>

                <div>

                  <span>
                    DISCORD ACCOUNT LINK
                  </span>

                  <h2>
                    Discord 연결 관리
                  </h2>

                </div>


                <button
                  className={styles.modalClose}
                  onClick={closeDiscordLinks}
                  disabled={
                    Boolean(
                      unlinkingDiscordId
                    )
                  }
                >
                  ×
                </button>

              </div>


              <div className={styles.discordMemberInfo}>

                <div>

                  <span>
                    길드원
                  </span>

                  <strong>
                    {linkManagingMember.nickname}
                  </strong>

                </div>

                <div>

                  <span>
                    GID
                  </span>

                  <strong>
                    {linkManagingMember.gid}
                  </strong>

                </div>

                <div>

                  <span>
                    길드
                  </span>

                  <strong>
                    {linkManagingMember.guild}
                  </strong>

                </div>

                <div>

                  <span>
                    연결상태
                  </span>

                  <strong>
                    {
                      discordLinks.length
                    }/2
                  </strong>

                </div>

              </div>


              {
                linkLoading &&
                (
                  <div className={styles.discordLoading}>
                    Discord 연결정보를 불러오는 중...
                  </div>
                )
              }


              {
                !linkLoading &&
                discordLinks.length === 0 &&
                (
                  <div className={styles.discordEmpty}>
                    연결된 Discord 계정이 없습니다.
                  </div>
                )
              }


              {
                !linkLoading &&
                discordLinks.length > 0 &&
                (
                  <div className={styles.discordLinkList}>

                    {
                      discordLinks.map(
                        (
                          link,
                          index
                        ) => (

                          <div
                            className={styles.discordLinkItem}
                            key={link.id}
                          >

                            <div className={styles.discordLinkIndex}>
                              {index + 1}
                            </div>


                            <div className={styles.discordLinkMain}>

                              <div className={styles.discordLinkName}>
                                {
                                  link.discordDisplayName ||
                                  link.discordUsername ||
                                  "Discord 사용자"
                                }
                              </div>

                              <div className={styles.discordLinkMeta}>
                                <span>
                                  {
                                    accountTypeLabel(
                                      link.accountType
                                    )
                                  }
                                </span>

                                <span>
                                  Discord ID · {
                                    link.discordId
                                  }
                                </span>
                              </div>

                            </div>


                            <button
                              className={styles.unlinkButton}
                              onClick={
                                () =>
                                  unlinkDiscordAccount(
                                    link
                                  )
                              }
                              disabled={
                                Boolean(
                                  unlinkingDiscordId
                                )
                              }
                            >
                              {
                                unlinkingDiscordId ===
                                link.discordId
                                  ? "해제 중..."
                                  : "연결 해제"
                              }
                            </button>

                          </div>

                        )
                      )
                    }

                  </div>
                )
              }


              {
                linkError &&
                (
                  <div className={styles.saveError}>
                    ! {linkError}
                  </div>
                )
              }


              <div className={styles.discordNotice}>
                <strong>
                  연결 규칙
                </strong>

                <p>
                  GID 1명당 Discord 계정은 최대 2개까지 연결됩니다.
                  본계정을 해제하고 추가 계정이 남아 있으면 남은 계정이
                  자동으로 본계정으로 전환됩니다.
                </p>
              </div>


              <div className={styles.modalActions}>

                <button
                  className={styles.cancelEditButton}
                  onClick={closeDiscordLinks}
                  disabled={
                    Boolean(
                      unlinkingDiscordId
                    )
                  }
                >
                  닫기
                </button>

              </div>

            </div>

          </div>

        )
      }

    </main>
  );
}
