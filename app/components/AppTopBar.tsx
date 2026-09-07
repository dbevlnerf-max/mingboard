"use client";

import Link from "next/link";

import {
  signOut,
  useSession,
} from "next-auth/react";

import {
  usePathname,
  useRouter,
} from "next/navigation";


export default function AppTopBar() {

  const {
    data:
      session,
  } =
    useSession();


  const pathname =
    usePathname();


  const router =
    useRouter();


  if (
    !session?.user
  ) {
    return null;
  }


  const isAdmin =
    pathname.startsWith(
      "/admin"
    );


  const isParticipation =
    pathname.startsWith(
      "/participation"
    );


  function goBack() {

    if (
      typeof window !==
        "undefined" &&
      window.history.length >
        1
    ) {

      router.back();

      return;
    }


    router.push(
      "/"
    );
  }


  return (

    <header className="topBar">


      <Link
        href="/"
        className="topBrandLink"
        aria-label="밍보드 홈으로 이동"
      >

        <div className="logo">
          ⚡ 게임하는밍쨩
        </div>

        <div className="serverName">
          아프로디테 2 · 핑뚝 / 빨뚝 / 검뚝
        </div>

      </Link>



      <nav
        className="topMenu"
        aria-label="밍보드 주요 메뉴"
      >

        <Link
          href="/"
          className={
            `menuItem ${
              pathname === "/"
                ? "active"
                : ""
            }`
          }
        >
          대시보드
        </Link>


        <Link
          href="/#boss"
          className="menuItem"
        >
          보스타임
        </Link>


        <Link
          href="/participation"
          className={
            `menuItem ${
              isParticipation
                ? "active"
                : ""
            }`
          }
        >
          참여점수
        </Link>


        <Link
          href="/#distribution"
          className="menuItem"
        >
          분배조회
        </Link>


        <Link
          href="/#guild"
          className="menuItem"
        >
          길드현황
        </Link>


        {
          (
            session.user.isAdmin ||
            session.user.isMaster
          ) &&
          (

            <Link
              href="/admin"
              className={
                `menuItem adminMenu ${
                  isAdmin
                    ? "active"
                    : ""
                }`
              }
            >
              ⚙ 관리자
            </Link>

          )
        }

      </nav>



      <div className="topRightArea">


        <div
          className="pageNavButtons"
          aria-label="페이지 이동"
        >

          <button
            type="button"
            className="pageNavButton"
            onClick={
              goBack
            }
            title="뒤로가기"
            aria-label="이전 페이지로 이동"
          >
            <span aria-hidden="true">
              ←
            </span>

            <small>
              뒤로
            </small>
          </button>


          <Link
            href="/"
            className="pageNavButton"
            title="홈"
            aria-label="홈으로 이동"
          >
            <span aria-hidden="true">
              ⌂
            </span>

            <small>
              홈
            </small>
          </Link>

        </div>



        <div className="discordUserBox">

          {
            session.user.image &&
            (

              <img
                src={
                  session.user.image
                }
                alt=""
              />

            )
          }


          <div>

            <strong>
              {
                session.user.name
              }
            </strong>

            <small>

              {
                session.user.isMaster
                  ? "MASTER"
                  : session.user.isAdmin
                    ? "ADMIN"
                    : "ZEUS"
              }

            </small>

          </div>


          <button
            type="button"
            onClick={
              () =>
                signOut()
            }
          >
            로그아웃
          </button>

        </div>


      </div>


    </header>

  );
}
