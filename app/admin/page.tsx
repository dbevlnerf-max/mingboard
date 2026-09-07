import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/auth";

import styles from "./admin.module.css";



export default async function AdminPage() {

  const session =
    await auth();


  if (
    !session?.user
  ) {
    redirect("/");
  }


  const user =
    session.user;


  if (
    !user.isGuildMember ||
    !user.hasZeusRole
  ) {
    redirect("/");
  }


  const canAccessAdmin =
    Boolean(
      user.isAdmin ||
      user.isMaster
    );


  if (
    !canAccessAdmin
  ) {

    return (

      <main className={styles.deniedPage}>

        <section className={styles.deniedCard}>

          <div className={styles.deniedIcon}>
            🔒
          </div>

          <div className={styles.deniedBadge}>
            ACCESS DENIED
          </div>

          <h1>
            관리자 전용 페이지입니다
          </h1>

          <p>
            현재 계정은 길드 대시보드 이용 권한만 가지고 있습니다.
            <br />
            관리자 기능은 운영진 권한이 있는 계정만 사용할 수 있습니다.
          </p>


          <div className={styles.deniedUser}>

            {
              user.image &&
              (

                <img
                  src={
                    user.image
                  }
                  alt=""
                />

              )
            }


            <div>

              <strong>
                {user.name}
              </strong>

              <span>
                ZEUS MEMBER
              </span>

            </div>

          </div>


          <Link
            href="/"
            className={styles.backButton}
          >
            ← 밍보드로 돌아가기
          </Link>

        </section>

      </main>
    );
  }


  const adminMenus = [

    {
      icon:
        "📢",

      title:
        "공지 관리",

      description:
        "길드 공지사항을 등록, 수정하고 고정 공지를 관리합니다.",

      status:
        "사용 가능",

      href:
        "/admin/notices",
    },


    {
      icon:
        "✓",

      title:
        "안내사항 관리",

      description:
        "밍보드에 항상 표시되는 길드 운영 안내문을 수정합니다.",

      status:
        "사용 가능",

      href:
        "/admin/guide",
    },


    {
      icon:
        "💎",

      title:
        "분배 기준 관리",

      description:
        "아이템 분배 기준과 최소 입찰 다이아를 관리합니다.",

      status:
        "준비중",

      href:
        null,
    },


    {
      icon:
        "⏰",

      title:
        "보스타임 관리",

      description:
        "보스 등록, 젠 주기와 밍봇 실시간 보스타임을 관리합니다.",

      status:
        "사용 가능",

      href:
        "/admin/boss-times",
    },


    {
      icon:
        "👥",

      title:
        "길드원 관리",

      description:
        "길드원 정보와 Discord 계정 연결을 관리합니다.",

      status:
        "사용 가능",

      href:
        "/admin/members",
    },


    {
      icon:
        "📊",

      title:
        "참여 운영 관리",

      description:
        "참여 집계기간과 Google Sheet 참여현황 동기화를 관리합니다.",

      status:
        "사용 가능",

      href:
        "/admin/participation",
    },


    {
      icon:
        "🤖",

      title:
        "밍봇 설정",

      description:
        "Discord 밍봇의 알림과 운영 설정을 관리합니다.",

      status:
        "준비중",

      href:
        null,
    },

  ];


  return (

    <main className={styles.adminPage}>

      <div className={styles.adminShell}>




        <div className={styles.adminContent}>


          <aside className={styles.sidebar}>


            <div className={styles.sideTop}>

              <div className={styles.sideLabel}>
                MINGBOARD
              </div>

              <h2>
                관리자
              </h2>

              <p>
                길드 운영 및 밍보드
                <br />
                통합 관리 페이지
              </p>

            </div>



            <nav className={styles.sideNav}>

              <div
                className={
                  `${styles.sideNavItem} ${styles.activeNav}`
                }
              >

                <span>
                  ▦
                </span>

                관리 홈

              </div>


              <Link
                href="/"
                className={styles.sideNavItem}
              >

                <span>
                  ←
                </span>

                밍보드

              </Link>

            </nav>



            <div className={styles.sideBottom}>

              <div className={styles.securityBox}>

                <span className={styles.securityIcon}>
                  🔐
                </span>

                <div>

                  <strong>
                    권한 보호
                  </strong>

                  <p>
                    Discord 역할 기반으로
                    관리자 권한을 확인합니다.
                  </p>

                </div>

              </div>

            </div>


          </aside>



          <section className={styles.mainArea}>


            <div className={styles.pageHeading}>


              <div>

                <div className={styles.eyebrow}>
                  ADMINISTRATION
                </div>

                <h1>
                  관리 대시보드
                </h1>

                <p>
                  아프로디테 2서버 핑뚝 · 빨뚝 · 검뚝 길드의
                  운영 정보를 한 곳에서 관리합니다.
                </p>

              </div>



              <div className={styles.permissionBadge}>

                <div
                  className={
                    user.isMaster
                      ? styles.permissionDotMaster
                      : styles.permissionDotAdmin
                  }
                />

                {
                  user.isMaster
                    ? "MASTER ACCESS"
                    : "ADMIN ACCESS"
                }

              </div>

            </div>



            <div className={styles.summaryRow}>


              <div className={styles.summaryCard}>

                <span>
                  관리 대상
                </span>

                <strong>
                  3
                </strong>

                <small>
                  핑뚝 · 빨뚝 · 검뚝
                </small>

              </div>



              <div className={styles.summaryCard}>

                <span>
                  인증 방식
                </span>

                <strong className={styles.summaryText}>
                  Discord
                </strong>

                <small>
                  역할 기반 접근 제어
                </small>

              </div>



              <div className={styles.summaryCard}>

                <span>
                  현재 권한
                </span>

                <strong className={styles.summaryText}>

                  {
                    user.isMaster
                      ? "MASTER"
                      : "ADMIN"
                  }

                </strong>

                <small>
                  정상 인증됨
                </small>

              </div>


            </div>



            <section className={styles.managementSection}>


              <div className={styles.sectionTitle}>

                <div>

                  <h2>
                    관리 메뉴
                  </h2>

                  <p>
                    필요한 기능을 선택하세요.
                  </p>

                </div>

              </div>



              <div className={styles.managementGrid}>


                {
                  adminMenus.map(
                    menu => {

                      const content = (

                        <>

                          <div className={styles.cardTop}>

                            <div className={styles.menuIcon}>
                              {menu.icon}
                            </div>

                            <div className={styles.cardStatus}>
                              {menu.status}
                            </div>

                          </div>


                          <h3>
                            {menu.title}
                          </h3>


                          <p>
                            {menu.description}
                          </p>


                          <div className={styles.cardBottom}>

                            <span>

                              {
                                menu.href
                                  ? "관리 페이지 열기"
                                  : "기능 연결 예정"
                              }

                            </span>

                            <span className={styles.cardArrow}>
                              →
                            </span>

                          </div>

                        </>

                      );


                      if (
                        menu.href
                      ) {

                        return (

                          <Link
                            href={
                              menu.href
                            }

                            className={styles.managementCard}

                            key={
                              menu.title
                            }
                          >

                            {content}

                          </Link>

                        );
                      }


                      return (

                        <div
                          className={styles.managementCard}

                          key={
                            menu.title
                          }
                        >
                          {content}
                        </div>

                      );

                    }
                  )
                }



                {
                  user.isMaster &&
                  (

                    <Link
                      href="/admin/audit"

                      className={
                        `${styles.managementCard} ${styles.masterCard}`
                      }
                    >

                      <div className={styles.cardTop}>

                        <div className={styles.menuIcon}>
                          📜
                        </div>

                        <div className={styles.masterOnlyBadge}>
                          MASTER ONLY
                        </div>

                      </div>


                      <h3>
                        수정 이력
                      </h3>


                      <p>
                        관리자 설정 변경 및 주요 운영 작업 기록을 확인합니다.
                      </p>


                      <div className={styles.cardBottom}>

                        <span>
                          이력 확인
                        </span>

                        <span className={styles.cardArrow}>
                          →
                        </span>

                      </div>

                    </Link>

                  )
                }


              </div>


            </section>


          </section>


        </div>


      </div>

    </main>
  );
}