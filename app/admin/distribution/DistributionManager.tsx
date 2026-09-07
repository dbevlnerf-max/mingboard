"use client";

import {
  useEffect,
  useState,
} from "react";

import Link
  from "next/link";

import styles
  from "./distribution.module.css";


type DistributionRule = {
  id: string;

  startRow: number;

  endRow: number;

  item: string;

  rule: string;

  minimumDiamonds: string[];
};


type Props = {
  currentUser: string;
  isMaster: boolean;
};


export default function DistributionManager({
  currentUser,
  isMaster,
}: Props) {

  const [
    rules,
    setRules,
  ] =
    useState<
      DistributionRule[]
    >(
      []
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


  const [
    editing,
    setEditing,
  ] =
    useState<
      DistributionRule |
      null
    >(
      null
    );


  const [
    formItem,
    setFormItem,
  ] =
    useState("");


  const [
    formRule,
    setFormRule,
  ] =
    useState("");


  const [
    formDiamonds,
    setFormDiamonds,
  ] =
    useState("");


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    saveError,
    setSaveError,
  ] =
    useState("");


  async function loadRules() {

    setLoading(
      true
    );

    setError("");


    try {

      const response =
        await fetch(
          "/api/admin/distribution",
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
          "분배기준을 불러오지 못했습니다."
        );
      }


      setRules(
        data.rules ||
        []
      );


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "분배기준을 불러오지 못했습니다."
      );


    } finally {

      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {

      loadRules();

    },
    []
  );


  function openEdit(
    rule:
      DistributionRule
  ) {

    setEditing(
      rule
    );


    setFormItem(
      rule.item
    );


    setFormRule(
      rule.rule
    );


    setFormDiamonds(
      rule
        .minimumDiamonds
        .join("\n")
    );


    setSaveError("");
  }


  function closeEdit() {

    if (
      saving
    ) {

      return;
    }


    setEditing(
      null
    );

    setSaveError("");
  }


  async function saveRule() {

    if (
      !editing
    ) {

      return;
    }


    const item =
      formItem.trim();


    const rule =
      formRule.trim();


    const minimumDiamonds =
      formDiamonds
        .split("\n")
        .map(
          line =>
            line.trim()
        )
        .filter(
          Boolean
        );


    if (
      !item
    ) {

      setSaveError(
        "항목명을 입력해주세요."
      );

      return;
    }


    if (
      !rule
    ) {

      setSaveError(
        "분배 관련 내용을 입력해주세요."
      );

      return;
    }


    const rowCount =
      editing.endRow -
      editing.startRow +
      1;


    if (
      minimumDiamonds.length >
      rowCount
    ) {

      setSaveError(
        `최소 다이아는 현재 표 구조상 최대 ${rowCount}줄까지 입력할 수 있습니다.`
      );

      return;
    }


    setSaving(
      true
    );

    setSaveError("");


    try {

      const response =
        await fetch(
          "/api/admin/distribution",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                startRow:
                  editing.startRow,

                item,

                rule,

                minimumDiamonds,

                beforeData: {
                  item:
                    editing.item,

                  rule:
                    editing.rule,

                  minimumDiamonds:
                    editing.minimumDiamonds,
                },
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
          "분배기준을 수정하지 못했습니다."
        );
      }


      await loadRules();


      setEditing(
        null
      );


    } catch (
      error
    ) {

      setSaveError(
        error instanceof Error
          ? error.message
          : "분배기준을 저장하지 못했습니다."
      );


    } finally {

      setSaving(
        false
      );
    }
  }


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


        <header
          className={
            styles.header
          }
        >

          <div>

            <Link
              href="/admin"
              className={
                styles.brand
              }
            >
              ⚡ 게임하는밍쨩
            </Link>


            <div
              className={
                styles.server
              }
            >
              아프로디테 2 · 핑뚝 / 빨뚝 / 검뚝
            </div>

          </div>


          <div
            className={
              styles.headerCenter
            }
          >
            Distribution Rules
          </div>


          <div
            className={
              styles.headerRight
            }
          >

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



        <div
          className={
            styles.content
          }
        >


          <section
            className={
              styles.titleSection
            }
          >

            <div>

              <div
                className={
                  styles.eyebrow
                }
              >
                GOOGLE SHEET · LIVE SYNC
              </div>


              <h1>
                분배 기준 관리
              </h1>


              <p>
                Google Sheet 📢공지사항의 분배기준을 실시간으로 조회하고 수정합니다.
              </p>

            </div>


            <div
              className={
                styles.titleActions
              }
            >

              <button
                className={
                  styles.refreshButton
                }
                onClick={
                  loadRules
                }
                disabled={
                  loading
                }
              >
                ↻ 시트 새로고침
              </button>


              <Link
                href="/admin"
                className={
                  styles.backButton
                }
              >
                ← 관리자 홈
              </Link>

            </div>

          </section>



          <div
            className={
              styles.syncNotice
            }
          >

            <span>
              ↔
            </span>

            <div>

              <strong>
                GOOGLE SHEET 양방향 연동
              </strong>


              <p>
                시트에서 수정하면 밍보드에 반영되고, 이 화면에서 수정하면 Google Sheet 원본에도 즉시 반영됩니다.
              </p>

            </div>

          </div>



          {
            loading &&
            (

              <div
                className={
                  styles.stateBox
                }
              >
                📡 Google Sheet에서 분배기준을 불러오는 중...
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

              <section
                className={
                  styles.rules
                }
              >

                {
                  rules.map(
                    (
                      rule,
                      index
                    ) => (

                      <article
                        key={
                          rule.id
                        }
                        className={
                          styles.ruleCard
                        }
                      >

                        <div
                          className={
                            styles.ruleNumber
                          }
                        >
                          {
                            String(
                              index +
                              1
                            ).padStart(
                              2,
                              "0"
                            )
                          }
                        </div>


                        <div
                          className={
                            styles.ruleBody
                          }
                        >

                          <div
                            className={
                              styles.ruleTop
                            }
                          >

                            <div>

                              <span
                                className={
                                  styles.ruleLabel
                                }
                              >
                                ITEM
                              </span>


                              <h2>
                                {rule.item}
                              </h2>

                            </div>


                            <button
                              className={
                                styles.editButton
                              }
                              onClick={
                                () =>
                                  openEdit(
                                    rule
                                  )
                              }
                            >
                              수정
                            </button>

                          </div>



                          <div
                            className={
                              styles.ruleGrid
                            }
                          >

                            <div
                              className={
                                styles.ruleSection
                              }
                            >

                              <span>
                                분배 관련
                              </span>

                              <p>
                                {rule.rule}
                              </p>

                            </div>


                            <div
                              className={
                                styles.priceSection
                              }
                            >

                              <span>
                                분배 최소다이아
                              </span>


                              <div
                                className={
                                  styles.priceList
                                }
                              >

                                {
                                  rule
                                    .minimumDiamonds
                                    .length >
                                  0
                                    ? rule
                                        .minimumDiamonds
                                        .map(
                                          (
                                            value,
                                            priceIndex
                                          ) => (

                                            <strong
                                              key={
                                                `${rule.id}-${priceIndex}`
                                              }
                                            >
                                              {value}
                                            </strong>

                                          )
                                        )
                                    : (
                                      <strong>
                                        -
                                      </strong>
                                    )
                                }

                              </div>

                            </div>

                          </div>

                        </div>

                      </article>

                    )
                  )
                }


                {
                  rules.length ===
                  0 &&
                  (

                    <div
                      className={
                        styles.stateBox
                      }
                    >
                      분배기준을 찾지 못했습니다.
                    </div>

                  )
                }

              </section>

            )
          }

        </div>

      </div>



      {
        editing &&
        (

          <div
            className={
              styles.modalBackdrop
            }
          >

            <div
              className={
                styles.modal
              }
            >

              <div
                className={
                  styles.modalHeader
                }
              >

                <div>

                  <span>
                    DISTRIBUTION RULE EDIT
                  </span>

                  <h2>
                    분배 기준 수정
                  </h2>

                </div>


                <button
                  className={
                    styles.modalClose
                  }
                  onClick={
                    closeEdit
                  }
                >
                  ×
                </button>

              </div>



              <div
                className={
                  styles.form
                }
              >

                <label>

                  <span>
                    항목
                  </span>

                  <input
                    value={
                      formItem
                    }
                    onChange={
                      event =>
                        setFormItem(
                          event
                            .target
                            .value
                        )
                    }
                  />

                </label>


                <label>

                  <span>
                    분배 관련
                  </span>

                  <textarea
                    value={
                      formRule
                    }
                    rows={
                      5
                    }
                    onChange={
                      event =>
                        setFormRule(
                          event
                            .target
                            .value
                        )
                    }
                  />

                </label>


                <label>

                  <span>
                    분배 최소다이아
                  </span>


                  <textarea
                    value={
                      formDiamonds
                    }
                    rows={
                      Math.max(
                        4,
                        editing.endRow -
                        editing.startRow +
                        1
                      )
                    }
                    placeholder={
                      "한 줄에 하나씩 입력\n예) T1 - 10,000 다이아"
                    }
                    onChange={
                      event =>
                        setFormDiamonds(
                          event
                            .target
                            .value
                        )
                    }
                  />


                  <small>
                    현재 Google Sheet 표 구조상 최대{" "}
                    <strong>
                      {
                        editing.endRow -
                        editing.startRow +
                        1
                      }
                    </strong>
                    줄까지 입력할 수 있습니다.
                  </small>

                </label>

              </div>


              {
                saveError &&
                (

                  <div
                    className={
                      styles.saveError
                    }
                  >
                    ! {saveError}
                  </div>

                )
              }


              <div
                className={
                  styles.modalActions
                }
              >

                <button
                  className={
                    styles.cancelButton
                  }
                  onClick={
                    closeEdit
                  }
                  disabled={
                    saving
                  }
                >
                  취소
                </button>


                <button
                  className={
                    styles.saveButton
                  }
                  onClick={
                    saveRule
                  }
                  disabled={
                    saving
                  }
                >
                  {
                    saving
                      ? "Google Sheet 저장 중..."
                      : "변경사항 저장"
                  }
                </button>

              </div>

            </div>

          </div>

        )
      }

    </main>
  );
}