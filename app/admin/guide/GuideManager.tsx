"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import styles from "./guide.module.css";


type Guide = {

  id: number;

  title: string;

  content: string;

  updated_by:
    string | null;

  updated_by_discord_id:
    string | null;

  updated_at: string;
};


type Props = {

  initialGuide:
    Guide | null;

  currentUser:
    string;

  isMaster:
    boolean;
};


function formatDate(
  value:
    string | null
) {

  if (
    !value
  ) {
    return "-";
  }


  return new Date(
    value
  ).toLocaleString(
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


export default function GuideManager({
  initialGuide,
  currentUser,
  isMaster,
}: Props) {

  const [
    guide,
    setGuide,
  ] =
    useState<
      Guide | null
    >(
      initialGuide
    );


  const [
    title,
    setTitle,
  ] =
    useState(
      initialGuide?.title ||
      "안내사항"
    );


  const [
    content,
    setContent,
  ] =
    useState(
      initialGuide?.content ||
      ""
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


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


  async function saveGuide() {

    if (
      !title.trim()
    ) {

      setErrorMessage(
        "안내 제목을 입력해주세요."
      );

      return;
    }


    if (
      !content.trim()
    ) {

      setErrorMessage(
        "안내 내용을 입력해주세요."
      );

      return;
    }


    setSaving(
      true
    );

    setMessage("");

    setErrorMessage("");


    try {

      const response =
        await fetch(
          "/api/dashboard-guide",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                title,
                content,
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
          "안내사항 저장에 실패했습니다."
        );
      }


      setGuide(
        data.guide
      );


      setTitle(
        data.guide.title
      );


      setContent(
        data.guide.content
      );


      setMessage(
        "안내사항을 저장했습니다."
      );

    } catch (
      error
    ) {

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "안내사항 저장에 실패했습니다."
      );

    } finally {

      setSaving(
        false
      );
    }
  }


  return (

    <main className={styles.page}>


      <div className={styles.shell}>


        {/* HEADER */}

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
            Guide Management
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


          {/* TITLE */}

          <section className={styles.titleSection}>


            <div>

              <div className={styles.eyebrow}>
                PERMANENT GUIDE
              </div>


              <h1>
                안내사항 관리
              </h1>


              <p>
                밍보드 공지사항 아래에 항상 표시되는 고정 안내문입니다.
              </p>

            </div>


            <Link
              href="/admin"
              className={styles.backButton}
            >
              ← 관리자 홈
            </Link>


          </section>



          {/* EDITOR */}

          <section className={styles.editorCard}>


            <div className={styles.editorHeader}>

              <div>

                <span>
                  DASHBOARD GUIDE
                </span>

                <h2>
                  안내 내용 수정
                </h2>

              </div>


              <div className={styles.liveBadge}>
                ● LIVE
              </div>

            </div>



            <div className={styles.formGroup}>

              <label>
                제목
              </label>


              <input
                type="text"

                value={
                  title
                }

                onChange={
                  (
                    event
                  ) =>
                    setTitle(
                      event.target.value
                    )
                }
              />

            </div>



            <div className={styles.formGroup}>

              <label>
                안내 내용
              </label>


              <textarea

                value={
                  content
                }

                placeholder={
                  "한 줄에 안내사항 하나씩 입력해주세요."
                }

                onChange={
                  (
                    event
                  ) =>
                    setContent(
                      event.target.value
                    )
                }

              />

              <small>
                한 줄에 한 항목씩 작성하면 밍보드에서 자동으로 목록 형태로 표시됩니다.
              </small>

            </div>



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
                  saveGuide
                }
              >

                {
                  saving
                    ? "저장 중..."
                    : "안내사항 저장"
                }

              </button>

            </div>


          </section>



          {/* PREVIEW */}

          <section className={styles.previewSection}>


            <div className={styles.previewTitle}>

              <div>

                <span>
                  PREVIEW
                </span>

                <h2>
                  밍보드 표시 미리보기
                </h2>

              </div>

            </div>



            <div className={styles.previewCard}>


              <h3>
                <span>
                  ✓
                </span>

                {
                  title ||
                  "안내사항"
                }
              </h3>


              <div className={styles.previewList}>

                {
                  content
                    .split("\n")
                    .map(
                      (
                        line
                      ) =>
                        line.trim()
                    )
                    .filter(
                      Boolean
                    )
                    .map(
                      (
                        line,
                        index
                      ) => (

                        <div
                          className={styles.previewItem}
                          key={
                            index
                          }
                        >

                          <span>
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


            </div>



            <div className={styles.updatedInfo}>

              최근 수정 ·{" "}

              {
                guide?.updated_by ||
                "초기 등록"
              }

              {" · "}

              {
                formatDate(
                  guide?.updated_at ||
                  null
                )
              }

            </div>


          </section>


        </div>


      </div>


    </main>
  );
}