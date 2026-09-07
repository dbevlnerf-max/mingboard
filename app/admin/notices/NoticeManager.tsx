"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import styles from "./notices.module.css";


type Notice = {
  id: number;

  title: string;

  content: string;

  is_pinned: boolean;

  created_by:
    string | null;

  created_by_discord_id:
    string | null;

  created_at: string;

  updated_at: string;
};


type Props = {

  initialNotices:
    Notice[];

  currentUser:
    string;

  isMaster:
    boolean;
};



function sortNotices(
  notices:
    Notice[]
) {

  return [
    ...notices,
  ].sort(
    (
      a,
      b
    ) => {

      if (
        a.is_pinned !==
        b.is_pinned
      ) {

        return a.is_pinned
          ? -1
          : 1;
      }


      return (
        new Date(
          b.created_at
        ).getTime() -

        new Date(
          a.created_at
        ).getTime()
      );
    }
  );
}



function formatDate(
  value: string
) {

  const date =
    new Date(
      value
    );


  return date
    .toLocaleString(
      "ko-KR",
      {
        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
}



export default function NoticeManager({
  initialNotices,
  currentUser,
  isMaster,
}: Props) {

  const [
    notices,
    setNotices,
  ] =
    useState<Notice[]>(
      sortNotices(
        initialNotices
      )
    );


  const [
    title,
    setTitle,
  ] =
    useState("");


  const [
    content,
    setContent,
  ] =
    useState("");


  const [
    isPinned,
    setIsPinned,
  ] =
    useState(false);


  const [
    editingId,
    setEditingId,
  ] =
    useState<
      number | null
    >(
      null
    );


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");



  /* =====================================================
     입력창 초기화
  ===================================================== */

  function resetForm() {

    setTitle("");

    setContent("");

    setIsPinned(false);

    setEditingId(
      null
    );
  }



  /* =====================================================
     공지 등록 / 수정
  ===================================================== */

  async function saveNotice() {

    if (
      !title.trim()
    ) {

      setErrorMessage(
        "공지 제목을 입력해주세요."
      );

      return;
    }


    if (
      !content.trim()
    ) {

      setErrorMessage(
        "공지 내용을 입력해주세요."
      );

      return;
    }


    setSaving(
      true
    );

    setMessage("");

    setErrorMessage("");


    try {

      const isEditing =
        editingId !==
        null;


      const response =
        await fetch(
          isEditing
            ? `/api/notices/${editingId}`
            : "/api/notices",

          {
            method:
              isEditing
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                title,
                content,
                isPinned,
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
          "공지 저장에 실패했습니다."
        );
      }


      const savedNotice:
        Notice =
        data.notice;


      if (
        isEditing
      ) {

        setNotices(
          (
            current
          ) =>
            sortNotices(
              current.map(
                (
                  notice
                ) =>
                  notice.id ===
                  savedNotice.id
                    ? savedNotice
                    : notice
              )
            )
        );


        setMessage(
          "공지사항을 수정했습니다."
        );

      } else {

        setNotices(
          (
            current
          ) =>
            sortNotices([
              savedNotice,
              ...current,
            ])
        );


        setMessage(
          "새 공지사항을 등록했습니다."
        );
      }


      resetForm();

    } catch (error) {

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "공지 저장에 실패했습니다."
      );

    } finally {

      setSaving(
        false
      );
    }
  }



  /* =====================================================
     수정 시작
  ===================================================== */

  function startEdit(
    notice:
      Notice
  ) {

    setEditingId(
      notice.id
    );


    setTitle(
      notice.title
    );


    setContent(
      notice.content
    );


    setIsPinned(
      notice.is_pinned
    );


    setMessage("");

    setErrorMessage("");


    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }



  /* =====================================================
     삭제
  ===================================================== */

  async function deleteNotice(
    notice:
      Notice
  ) {

    const confirmed =
      window.confirm(
        `"${notice.title}" 공지를 삭제할까요?`
      );


    if (
      !confirmed
    ) {
      return;
    }


    setMessage("");

    setErrorMessage("");


    try {

      const response =
        await fetch(
          `/api/notices/${notice.id}`,
          {
            method:
              "DELETE",
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
          "공지 삭제에 실패했습니다."
        );
      }


      setNotices(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              notice.id
          )
      );


      if (
        editingId ===
        notice.id
      ) {

        resetForm();
      }


      setMessage(
        "공지사항을 삭제했습니다."
      );

    } catch (error) {

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "공지 삭제에 실패했습니다."
      );
    }
  }



  return (

    <main className={styles.page}>


      <div className={styles.shell}>


        {/* =================================================
            HEADER
        ================================================= */}

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
            Notice Management
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



        {/* =================================================
            CONTENT
        ================================================= */}

        <div className={styles.content}>


          {/* =================================================
              TITLE
          ================================================= */}

          <section className={styles.titleSection}>


            <div>

              <div className={styles.eyebrow}>
                NOTICE MANAGEMENT
              </div>


              <h1>
                공지 관리
              </h1>


              <p>
                밍보드에 노출되는 길드 공지사항을 등록하고 관리합니다.
              </p>

            </div>


            <Link
              href="/admin"
              className={styles.backButton}
            >
              ← 관리자 홈
            </Link>


          </section>



          {/* =================================================
              FORM
          ================================================= */}

          <section className={styles.editorCard}>


            <div className={styles.editorHeader}>


              <div>

                <span className={styles.editorLabel}>
                  {
                    editingId
                      ? "EDIT NOTICE"
                      : "NEW NOTICE"
                  }
                </span>


                <h2>
                  {
                    editingId
                      ? "공지 수정"
                      : "새 공지 작성"
                  }
                </h2>

              </div>


              {
                editingId &&
                (

                  <button
                    className={styles.cancelButton}

                    onClick={
                      resetForm
                    }
                  >
                    수정 취소
                  </button>

                )
              }


            </div>



            <div className={styles.formGroup}>

              <label>
                제목
              </label>


              <input
                type="text"

                maxLength={100}

                value={title}

                placeholder="공지 제목을 입력하세요."

                onChange={
                  (
                    event
                  ) =>
                    setTitle(
                      event.target.value
                    )
                }
              />


              <small>
                {title.length} / 100
              </small>

            </div>



            <div className={styles.formGroup}>

              <label>
                내용
              </label>


              <textarea
                value={content}

                placeholder="길드원에게 전달할 내용을 입력하세요."

                onChange={
                  (
                    event
                  ) =>
                    setContent(
                      event.target.value
                    )
                }
              />

            </div>



            <label className={styles.pinOption}>

              <input
                type="checkbox"

                checked={isPinned}

                onChange={
                  (
                    event
                  ) =>
                    setIsPinned(
                      event.target.checked
                    )
                }
              />


              <div>

                <strong>
                  📌 중요 공지로 고정
                </strong>

                <span>
                  일반 공지보다 위에 표시됩니다.
                </span>

              </div>

            </label>



            {
              message &&
              (

                <div className={styles.successMessage}>
                  ✓ {message}
                </div>

              )
            }


            {
              errorMessage &&
              (

                <div className={styles.errorMessage}>
                  ! {errorMessage}
                </div>

              )
            }



            <div className={styles.formActions}>


              <button
                className={styles.saveButton}

                disabled={
                  saving
                }

                onClick={
                  saveNotice
                }
              >

                {
                  saving
                    ? "저장 중..."
                    : editingId
                    ? "공지 수정 저장"
                    : "공지 등록"
                }

              </button>


            </div>


          </section>



          {/* =================================================
              NOTICE LIST
          ================================================= */}

          <section className={styles.listSection}>


            <div className={styles.listHeader}>


              <div>

                <h2>
                  등록된 공지
                </h2>

                <p>
                  현재 총 {notices.length}개의 공지가 등록되어 있습니다.
                </p>

              </div>


              <div className={styles.noticeCount}>
                {notices.length}
              </div>


            </div>



            {
              notices.length ===
              0
                ? (

                  <div className={styles.emptyState}>

                    <div>
                      📭
                    </div>

                    <strong>
                      등록된 공지가 없습니다.
                    </strong>

                    <span>
                      위에서 첫 공지를 작성해보세요.
                    </span>

                  </div>

                )
                : (

                  <div className={styles.noticeList}>


                    {
                      notices.map(
                        (
                          notice
                        ) => (

                          <article
                            className={
                              notice.is_pinned
                                ? `${styles.noticeCard} ${styles.pinnedCard}`
                                : styles.noticeCard
                            }

                            key={
                              notice.id
                            }
                          >


                            <div className={styles.noticeTop}>


                              <div className={styles.noticeTitleArea}>


                                {
                                  notice.is_pinned &&
                                  (

                                    <span className={styles.pinnedBadge}>
                                      📌 고정
                                    </span>

                                  )
                                }


                                <h3>
                                  {notice.title}
                                </h3>


                              </div>



                              <div className={styles.noticeActions}>


                                <button
                                  className={styles.editButton}

                                  onClick={
                                    () =>
                                      startEdit(
                                        notice
                                      )
                                  }
                                >
                                  수정
                                </button>


                                <button
                                  className={styles.deleteButton}

                                  onClick={
                                    () =>
                                      deleteNotice(
                                        notice
                                      )
                                  }
                                >
                                  삭제
                                </button>


                              </div>


                            </div>



                            <div className={styles.noticeContent}>

                              {notice.content}

                            </div>



                            <div className={styles.noticeMeta}>


                              <span>
                                작성자 · {
                                  notice.created_by ||
                                  "관리자"
                                }
                              </span>


                              <span>
                                {
                                  formatDate(
                                    notice.created_at
                                  )
                                }
                              </span>


                            </div>


                          </article>

                        )
                      )
                    }


                  </div>

                )
            }


          </section>


        </div>


      </div>


    </main>
  );
}