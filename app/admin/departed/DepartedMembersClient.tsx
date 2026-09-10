"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import styles from "./departed.module.css";


type DepartedMember = {
  gid: string;
  nickname: string;
  job: string;
  growthPower: string;
  growthPowerNumber: number;
  guild: string;
  attendanceRate: string;
  participationCount: number;
  targetCount: number;
  status: string;
  leftAt: string;
};


type Props = {
  currentUser: string;
  isMaster: boolean;
};


export default function DepartedMembersClient({
  currentUser,
  isMaster,
}: Props) {
  const [members, setMembers] =
    useState<DepartedMember[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [deletingMember, setDeletingMember] =
    useState<DepartedMember | null>(null);

  const [confirmNickname, setConfirmNickname] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const [deleteError, setDeleteError] =
    useState("");


  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/departed-members",
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "탈퇴 인원 정보를 불러오지 못했습니다."
        );
      }

      setMembers(
        Array.isArray(data.members)
          ? data.members
          : []
      );

    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "탈퇴 인원 정보를 불러오지 못했습니다."
      );

    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadMembers();
  }, []);


  const filteredMembers =
    useMemo(() => {
      const keyword =
        search.trim().toLowerCase();

      if (!keyword) {
        return members;
      }

      return members.filter(
        member =>
          member.nickname
            .toLowerCase()
            .includes(keyword) ||
          member.gid.includes(keyword) ||
          member.guild
            .toLowerCase()
            .includes(keyword)
      );
    }, [members, search]);


  function openPermanentDelete(
    member: DepartedMember
  ) {
    setDeletingMember(member);
    setConfirmNickname("");
    setDeleteError("");
  }


  function closePermanentDelete() {
    if (deleting) {
      return;
    }

    setDeletingMember(null);
    setConfirmNickname("");
    setDeleteError("");
  }


  async function permanentDelete() {
    if (!deletingMember) {
      return;
    }

    if (
      confirmNickname.trim() !==
      deletingMember.nickname
    ) {
      setDeleteError(
        "영구삭제할 길드원의 닉네임을 정확히 입력해주세요."
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        "/api/admin/departed-members",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gid: deletingMember.gid,
            confirmNickname:
              confirmNickname.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "영구삭제에 실패했습니다."
        );
      }

      setMembers(current =>
        current.filter(
          member =>
            member.gid !==
            deletingMember.gid
        )
      );

      setDeletingMember(null);
      setConfirmNickname("");

      if (data.warning) {
        window.alert(
          `영구삭제는 완료됐지만 확인할 항목이 있습니다.\n${data.warning}`
        );
      }

    } catch (err) {
      console.error(err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "영구삭제하지 못했습니다."
      );

    } finally {
      setDeleting(false);
    }
  }


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
            <p>
              탈퇴 인원 관리
            </p>
          </div>

          <div className={styles.headerRight}>
            <span>{currentUser}</span>
            <strong>
              {isMaster ? "MASTER" : "ADMIN"}
            </strong>
          </div>
        </header>

        <section className={styles.titleRow}>
          <div>
            <div className={styles.eyebrow}>
              DEPARTED MEMBERS
            </div>
            <h1>
              탈퇴 인원
            </h1>
            <p>
              탈퇴처리된 길드원은 이곳에 보관됩니다. 영구삭제 전까지 GID와 기본정보가 유지됩니다.
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={loadMembers}
              disabled={loading}
            >
              ↻ 새로고침
            </button>
            <Link href="/admin/members">
              활동 길드원
            </Link>
            <Link href="/admin">
              ← 관리자 홈
            </Link>
          </div>
        </section>

        <section className={styles.toolbar}>
          <input
            value={search}
            onChange={event =>
              setSearch(event.target.value)
            }
            placeholder="닉네임 · GID · 길드 검색"
          />

          <div className={styles.countBox}>
            탈퇴 인원
            <strong>{filteredMembers.length}</strong>
            명
          </div>
        </section>

        {loading && (
          <div className={styles.stateBox}>
            탈퇴 인원 정보를 불러오는 중...
          </div>
        )}

        {!loading && error && (
          <div className={`${styles.stateBox} ${styles.errorBox}`}>
            {error}
          </div>
        )}

        {!loading && !error && (
          <section className={styles.tableWrap}>
            <div className={styles.tableHeader}>
              <span>GID</span>
              <span>닉네임</span>
              <span>직업</span>
              <span>성장력</span>
              <span>길드</span>
              <span>탈퇴일</span>
              <span>관리</span>
            </div>

            {filteredMembers.map(member => (
              <div
                className={styles.tableRow}
                key={member.gid}
              >
                <span className={styles.gid}>
                  {member.gid}
                </span>
                <strong>
                  {member.nickname}
                </strong>
                <span>
                  {member.job || "-"}
                </span>
                <span>
                  {member.growthPower || "-"}
                </span>
                <span>
                  {member.guild || "-"}
                </span>
                <span>
                  {member.leftAt || "-"}
                </span>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() =>
                    openPermanentDelete(member)
                  }
                >
                  영구삭제
                </button>
              </div>
            ))}

            {filteredMembers.length === 0 && (
              <div className={styles.empty}>
                보관 중인 탈퇴 인원이 없습니다.
              </div>
            )}
          </section>
        )}
      </div>

      {deletingMember && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <div>
                <span>PERMANENT DELETE</span>
                <h2>탈퇴 인원 영구삭제</h2>
              </div>
              <button
                type="button"
                onClick={closePermanentDelete}
                disabled={deleting}
              >
                ×
              </button>
            </div>

            <div className={styles.warning}>
              <strong>
                {deletingMember.nickname}
              </strong>
              <p>
                Google Sheet의 길드원 기본정보를 실제로 삭제합니다. Discord 연결 이력과 감사기록은 추적을 위해 보존됩니다.
              </p>
            </div>

            <label className={styles.confirmField}>
              <span>
                확인을 위해 닉네임을 입력하세요.
              </span>
              <input
                value={confirmNickname}
                placeholder={deletingMember.nickname}
                onChange={event =>
                  setConfirmNickname(
                    event.target.value
                  )
                }
              />
            </label>

            {deleteError && (
              <div className={styles.modalError}>
                ! {deleteError}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={closePermanentDelete}
                disabled={deleting}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.confirmDelete}
                onClick={permanentDelete}
                disabled={
                  deleting ||
                  confirmNickname.trim() !==
                    deletingMember.nickname
                }
              >
                {deleting
                  ? "삭제 중..."
                  : "영구삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
