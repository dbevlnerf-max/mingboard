import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import {
  supabaseAdmin,
} from "@/lib/supabase/admin";

import styles from "./audit.module.css";


type AuditLog = {
  id: number;

  action:
    | "CREATE"
    | "UPDATE"
    | "DELETE";

  target_type:
    string;

  target_id:
    string | null;

  target_name:
    string | null;

  actor_discord_id:
    string;

  actor_name:
    string | null;

  actor_role:
    string;

  before_data:
    Record<
      string,
      unknown
    > | null;

  after_data:
    Record<
      string,
      unknown
    > | null;

  description:
    string | null;

  created_at:
    string;
};


function formatDate(
  value: string
) {

  return new Date(
    value
  ).toLocaleString(
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

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        false,
    }
  );
}


function valueText(
  value: unknown
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "-";
  }


  if (
    typeof value ===
    "number"
  ) {

    return value.toLocaleString();
  }


  if (
    typeof value ===
    "boolean"
  ) {

    return value
      ? "사용"
      : "미사용";
  }


  return String(
    value
  );
}


function getTargetLabel(
  type: string
) {

  if (
    type ===
    "guild_member"
  ) {

    return "길드원";
  }


  if (
    type ===
    "notice"
  ) {

    return "공지";
  }


  if (
    type ===
    "guide"
  ) {

    return "안내";
  }


  return "관리";
}


function getChangedFields(
  before:
    Record<
      string,
      unknown
    > | null,

  after:
    Record<
      string,
      unknown
    > | null
) {

  if (
    !before ||
    !after
  ) {

    return [];
  }


  const labels:
    Record<
      string,
      string
    > = {

      nickname:
        "닉네임",

      job:
        "직업",

      growthPower:
        "성장력",

      growthPowerNumber:
        "성장력",

      guild:
        "길드",

      title:
        "제목",

      content:
        "내용",

      is_pinned:
        "고정공지",
    };


  const keys =
    new Set([
      ...Object.keys(
        before
      ),

      ...Object.keys(
        after
      ),
    ]);


  const ignoredKeys =
    new Set([
      "id",
      "gid",
      "attendanceRate",
      "participationCount",
      "targetCount",
    ]);


  const results:
    Array<{
      key: string;
      label: string;
      before: unknown;
      after: unknown;
    }> =
    [];


  for (
    const key of keys
  ) {

    if (
      ignoredKeys.has(
        key
      )
    ) {

      continue;
    }


    if (
      key ===
      "growthPowerNumber"
    ) {

      continue;
    }


    let beforeValue =
      before[key];


    let afterValue =
      after[key];


    if (
      key ===
      "growthPower"
    ) {

      beforeValue =
        before.growthPowerNumber ??
        before.growthPower;


      afterValue =
        after.growthPowerNumber ??
        after.growthPower;
    }


    if (
      String(
        beforeValue ?? ""
      ) ===
      String(
        afterValue ?? ""
      )
    ) {

      continue;
    }


    results.push({

      key,

      label:
        labels[key] ||
        key,

      before:
        beforeValue,

      after:
        afterValue,
    });
  }


  return results;
}


function shortenText(
  value: unknown
) {

  const text =
    valueText(
      value
    );


  if (
    text.length <=
    90
  ) {

    return text;
  }


  return (
    text.slice(
      0,
      90
    ) +
    "..."
  );
}


export default async function AuditPage() {

  const session =
    await auth();


  if (
    !session?.user
  ) {

    redirect("/");
  }


  if (
    !session.user.isGuildMember ||
    !session.user.hasZeusRole
  ) {

    redirect("/");
  }


  if (
    !session.user.isMaster
  ) {

    redirect(
      "/admin"
    );
  }


  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "audit_logs"
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending:
            false,
        }
      )
      .limit(
        300
      );


  const logs =
    (
      data ||
      []
    ) as AuditLog[];


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


          <div className={styles.headerBadge}>
            MASTER AUDIT
          </div>


          <div className={styles.masterUser}>

            <span>
              👑
            </span>

            <div>

              <strong>
                {
                  session.user.name ||
                  "MASTER"
                }
              </strong>

              <small>
                MASTER
              </small>

            </div>

          </div>

        </header>



        <div className={styles.content}>


          <div className={styles.pageTitle}>

            <div>

              <span>
                SECURITY · AUDIT HISTORY
              </span>

              <h1>
                수정 이력
              </h1>

              <p>
                길드원, 공지사항, 안내사항 등 주요 운영 변경 기록입니다.
              </p>

            </div>


            <Link
              href="/admin"
              className={styles.backButton}
            >
              ← 관리자 홈
            </Link>

          </div>



          <div className={styles.securityNotice}>

            <div className={styles.lockIcon}>
              🔐
            </div>

            <div>

              <strong>
                MASTER ONLY
              </strong>

              <p>
                이 페이지는 MASTER 계정만 조회할 수 있습니다.
                관리자 작업은 삭제되지 않는 운영 이력으로 기록됩니다.
              </p>

            </div>

          </div>



          <div className={styles.summaryBar}>

            <div>

              <span>
                표시 기록
              </span>

              <strong>
                {logs.length}
              </strong>

            </div>


            <div>

              <span>
                최근 기록
              </span>

              <strong className={styles.summaryText}>

                {
                  logs.length > 0
                    ? formatDate(
                        logs[0]
                          .created_at
                      )
                    : "-"
                }

              </strong>

            </div>


            <div>

              <span>
                보존 방식
              </span>

              <strong className={styles.summaryText}>
                Supabase
              </strong>

            </div>

          </div>



          {
            error &&
            (

              <div className={styles.errorBox}>

                수정 이력을 불러오지 못했습니다.

                <small>
                  {error.message}
                </small>

              </div>

            )
          }


          {
            !error &&
            logs.length === 0 &&
            (

              <div className={styles.emptyBox}>
                아직 기록된 수정 이력이 없습니다.
              </div>

            )
          }



          <section className={styles.logList}>

            {
              logs.map(
                log => {

                  const changed =
                    getChangedFields(
                      log.before_data,
                      log.after_data
                    );


                  return (

                    <article
                      className={styles.logCard}
                      key={
                        log.id
                      }
                    >

                      <div className={styles.logMain}>


                        <div
                          className={
                            log.action ===
                            "CREATE"
                              ? `${styles.actionBadge} ${styles.create}`
                              : log.action ===
                                "DELETE"
                              ? `${styles.actionBadge} ${styles.delete}`
                              : `${styles.actionBadge} ${styles.update}`
                          }
                        >

                          {
                            log.action ===
                            "CREATE"
                              ? "추가"
                              : log.action ===
                                "DELETE"
                              ? "삭제"
                              : "수정"
                          }

                        </div>



                        <div className={styles.logInfo}>

                          <div className={styles.logTitle}>

                            <strong>

                              [
                              {
                                getTargetLabel(
                                  log.target_type
                                )
                              }
                              ]
                              {" "}

                              {
                                log.target_name ||
                                log.target_id ||
                                "대상 없음"
                              }

                            </strong>

                            <span>
                              {
                                log.description ||
                                "관리 작업"
                              }
                            </span>

                          </div>


                          <div className={styles.metaRow}>

                            <span>
                              작업자
                            </span>

                            <strong>
                              {
                                log.actor_name ||
                                log.actor_discord_id
                              }
                            </strong>


                            <span
                              className={
                                log.actor_role ===
                                "MASTER"
                                  ? styles.masterBadge
                                  : styles.adminBadge
                              }
                            >
                              {
                                log.actor_role
                              }
                            </span>


                            <span className={styles.separator}>
                              ·
                            </span>


                            <span>
                              {
                                formatDate(
                                  log.created_at
                                )
                              }
                            </span>


                            {
                              log.target_id &&
                              log.target_type ===
                                "guild_member" &&
                              (

                                <>

                                  <span className={styles.separator}>
                                    ·
                                  </span>

                                  <span>
                                    GID {log.target_id}
                                  </span>

                                </>

                              )
                            }

                          </div>

                        </div>

                      </div>



                      {
                        log.action ===
                          "UPDATE" &&
                        changed.length >
                          0 &&
                        (

                          <div className={styles.changeList}>

                            {
                              changed.map(
                                change => (

                                  <div
                                    className={styles.changeRow}
                                    key={
                                      change.key
                                    }
                                  >

                                    <strong>
                                      {change.label}
                                    </strong>

                                    <span className={styles.oldValue}>
                                      {
                                        shortenText(
                                          change.before
                                        )
                                      }
                                    </span>

                                    <span className={styles.arrow}>
                                      →
                                    </span>

                                    <span className={styles.newValue}>
                                      {
                                        shortenText(
                                          change.after
                                        )
                                      }
                                    </span>

                                  </div>

                                )
                              )
                            }

                          </div>

                        )
                      }



                      {
                        log.action ===
                          "CREATE" &&
                        log.after_data &&
                        (

                          <div className={styles.detailRow}>

                            {
                              log.target_type ===
                                "guild_member" &&
                              (
                                <>
                                  <span>
                                    {
                                      valueText(
                                        log.after_data.job
                                      )
                                    }
                                  </span>

                                  <span>
                                    성장력{" "}
                                    {
                                      valueText(
                                        log.after_data.growthPower
                                      )
                                    }
                                  </span>

                                  <span>
                                    {
                                      valueText(
                                        log.after_data.guild
                                      )
                                    }
                                  </span>
                                </>
                              )
                            }


                            {
                              log.target_type ===
                                "notice" &&
                              (
                                <>
                                  <span>
                                    {
                                      log.after_data.is_pinned
                                        ? "📌 고정공지"
                                        : "일반공지"
                                    }
                                  </span>

                                  <span>
                                    {
                                      shortenText(
                                        log.after_data.content
                                      )
                                    }
                                  </span>
                                </>
                              )
                            }


                            {
                              log.target_type ===
                                "guide" &&
                              (
                                <span>
                                  {
                                    shortenText(
                                      log.after_data.content
                                    )
                                  }
                                </span>
                              )
                            }

                          </div>

                        )
                      }



                      {
                        log.action ===
                          "DELETE" &&
                        log.before_data &&
                        (

                          <div className={styles.detailRow}>

                            {
                              log.target_type ===
                                "guild_member" &&
                              (
                                <>
                                  <span>
                                    {
                                      valueText(
                                        log.before_data.job
                                      )
                                    }
                                  </span>

                                  <span>
                                    성장력{" "}
                                    {
                                      valueText(
                                        log.before_data.growthPowerNumber ??
                                        log.before_data.growthPower
                                      )
                                    }
                                  </span>

                                  <span>
                                    {
                                      valueText(
                                        log.before_data.guild
                                      )
                                    }
                                  </span>
                                </>
                              )
                            }


                            {
                              log.target_type ===
                                "notice" &&
                              (
                                <span>
                                  {
                                    shortenText(
                                      log.before_data.content
                                    )
                                  }
                                </span>
                              )
                            }

                          </div>

                        )
                      }

                    </article>

                  );
                }
              )
            }

          </section>


        </div>

      </div>

    </main>
  );
}