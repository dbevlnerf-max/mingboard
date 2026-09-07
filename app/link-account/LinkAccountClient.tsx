"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


// ============================================================
// TYPE
// ============================================================

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

  discordLinkCount: number;

  discordLinkMax: number;

  primaryCount: number;

  additionalCount: number;

  full: boolean;

  canPrimary: boolean;

  canAdditional: boolean;
};


type MyLink = {
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

  member:
    | {
        gid: string;
        nickname: string;
        job: string;
        guild: string;
        growthPower: string;
      }
    | null;
};


type AccountLinkResponse = {
  success: boolean;

  message?: string;

  discord?: {
    id: string;
    username: string;
  };

  linked?: boolean;

  myLink?:
    | MyLink
    | null;

  members?: GuildMember[];
};


// ============================================================
// 계정 유형 표시
// ============================================================

function accountTypeLabel(
  type:
    | string
    | null
    | undefined
) {
  if (
    type ===
    "primary"
  ) {
    return "본계정";
  }


  if (
    type ===
    "sub"
  ) {
    return "부주";
  }


  if (
    type ===
    "discord_alt"
  ) {
    return "디코부계정";
  }


  return "-";
}


// ============================================================
// 길드 배지 색상
// ============================================================

function guildBadgeStyle(
  guild: string
) {
  if (
    guild ===
    "핑뚝"
  ) {
    return {
      color:
        "#ffb5d8",

      border:
        "1px solid rgba(255, 110, 185, 0.28)",

      background:
        "rgba(255, 70, 160, 0.08)",
    };
  }


  if (
    guild ===
    "빨뚝"
  ) {
    return {
      color:
        "#ffb1b1",

      border:
        "1px solid rgba(255, 95, 95, 0.28)",

      background:
        "rgba(255, 65, 65, 0.08)",
    };
  }


  if (
    guild ===
    "검뚝"
  ) {
    return {
      color:
        "#dddddd",

      border:
        "1px solid #444",

      background:
        "#171717",
    };
  }


  return {
    color:
      "#ddd",

    border:
      "1px solid #444",

    background:
      "#171717",
  };
}


// ============================================================
// COMPONENT
// ============================================================

export default function LinkAccountClient() {
  const router =
    useRouter();


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState("");


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    discordName,
    setDiscordName,
  ] =
    useState("");


  const [
    linked,
    setLinked,
  ] =
    useState(
      false
    );


  const [
    myLink,
    setMyLink,
  ] =
    useState<
      MyLink |
      null
    >(
      null
    );


  const [
    members,
    setMembers,
  ] =
    useState<
      GuildMember[]
    >(
      []
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    selectedGid,
    setSelectedGid,
  ] =
    useState("");


  const [
    additionalInput,
    setAdditionalInput,
  ] =
    useState(
      false
    );


  const [
    additionalType,
    setAdditionalType,
  ] =
    useState<
      "sub" |
      "discord_alt"
    >(
      "sub"
    );


  // ==========================================================
  // API 조회
  // ==========================================================

  async function loadData() {
    setLoading(
      true
    );

    setError("");


    try {
      const response =
        await fetch(
          "/api/account-link",
          {
            cache:
              "no-store",
          }
        );


      const data:
        AccountLinkResponse =
          await response.json();


      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
          "계정 연결 정보를 불러오지 못했습니다."
        );
      }


      setDiscordName(
        data.discord
          ?.username ??
        ""
      );


      setLinked(
        Boolean(
          data.linked
        )
      );


      setMyLink(
        data.myLink ??
        null
      );


      setMembers(
        Array.isArray(
          data.members
        )
          ? data.members
          : []
      );


    } catch (
      error
    ) {
      setError(
        error instanceof
        Error
          ? error.message
          : "계정 연결 정보를 불러오지 못했습니다."
      );


    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      loadData();
    },
    []
  );


  // ==========================================================
  // 검색
  // ==========================================================

  const filteredMembers =
    useMemo(
      () => {
        const keyword =
          search
            .trim()
            .toLowerCase();


        if (!keyword) {
          return members;
        }


        return members.filter(
          member =>
            member.nickname
              .toLowerCase()
              .includes(
                keyword
              ) ||

            member.guild
              .toLowerCase()
              .includes(
                keyword
              ) ||

            member.job
              .toLowerCase()
              .includes(
                keyword
              ) ||

            member.gid
              .toLowerCase()
              .includes(
                keyword
              )
        );
      },
      [
        members,
        search,
      ]
    );


  // ==========================================================
  // 선택 길드원
  // ==========================================================

  const selectedMember =
    useMemo(
      () =>
        members.find(
          member =>
            member.gid ===
            selectedGid
        ) ??
        null,
      [
        members,
        selectedGid,
      ]
    );


  // ==========================================================
  // 선택
  // ==========================================================

  function selectMember(
    member:
      GuildMember
  ) {
    if (
      member.full
    ) {
      return;
    }


    setSelectedGid(
      member.gid
    );


    if (
      member.discordLinkCount ===
      0
    ) {
      setAdditionalInput(
        false
      );


      return;
    }


    if (
      member.discordLinkCount ===
      1
    ) {
      setAdditionalInput(
        true
      );
    }
  }


  // ==========================================================
  // 연결
  // ==========================================================

  async function submitLink() {
    if (
      !selectedMember
    ) {
      setError(
        "게임 닉네임을 선택해주세요."
      );

      return;
    }


    if (
      selectedMember.full
    ) {
      setError(
        "이미 Discord 계정이 2/2 연결되어 있습니다."
      );

      return;
    }


    if (
      selectedMember.discordLinkCount ===
        1 &&
      !additionalInput
    ) {
      setError(
        "추가 계정 연결을 선택해주세요."
      );

      return;
    }


    setSaving(
      true
    );

    setError("");
    setMessage("");


    try {
      const body:
        Record<
          string,
          unknown
        > = {
          gid:
            selectedMember.gid,
        };


      if (
        selectedMember.discordLinkCount ===
        1
      ) {
        body.additional =
          true;

        body.accountType =
          additionalType;
      }


      const response =
        await fetch(
          "/api/account-link",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),
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
          "계정 연결에 실패했습니다."
        );
      }


      setMessage(
        data.message ||
        "계정 연결이 완료되었습니다."
      );


      await loadData();


      window.setTimeout(
        () => {
          router.push(
            "/"
          );

          router.refresh();
        },
        900
      );


    } catch (
      error
    ) {
      setError(
        error instanceof
        Error
          ? error.message
          : "계정 연결에 실패했습니다."
      );


    } finally {
      setSaving(
        false
      );
    }
  }


  // ==========================================================
  // 이미 연결된 경우
  // ==========================================================

  if (
    !loading &&
    linked &&
    myLink
  ) {
    return (
      <main
        style={{
          minHeight:
            "100vh",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          padding:
            "30px",

          background:
            "#050505",

          color:
            "#fff",
        }}
      >
        <section
          style={{
            width:
              "100%",

            maxWidth:
              "520px",

            padding:
              "30px",

            background:
              "#0d0d0d",

            border:
              "1px solid #292929",

            borderRadius:
              "16px",
          }}
        >
          <div
            style={{
              color:
                "#888",

              fontSize:
                "10px",

              fontWeight:
                900,

              letterSpacing:
                "1.6px",
            }}
          >
            ACCOUNT LINK
          </div>


          <h1
            style={{
              margin:
                "9px 0 0",

              fontSize:
                "26px",
            }}
          >
            계정 연결 완료
          </h1>


          <p
            style={{
              color:
                "#aaa",

              fontSize:
                "12px",
            }}
          >
            현재 Discord 계정은 이미 길드원 정보와 연결되어 있습니다.
          </p>


          <div
            style={{
              marginTop:
                "22px",

              padding:
                "18px",

              background:
                "#111",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "10px",
            }}
          >
            <div
              style={{
                fontSize:
                  "18px",

                fontWeight:
                  900,
              }}
            >
              {
                myLink.member
                  ?.nickname ??
                `GID ${myLink.gid}`
              }
            </div>


            <div
              style={{
                marginTop:
                  "7px",

                color:
                  "#aaa",

                fontSize:
                  "11px",
              }}
            >
              {
                myLink.member
                  ?.guild ??
                "-"
              }

              {" · "}

              {
                myLink.member
                  ?.job ??
                "-"
              }
            </div>


            <div
              style={{
                marginTop:
                  "13px",

                display:
                  "inline-block",

                padding:
                  "5px 8px",

                color:
                  "#bceec8",

                background:
                  "rgba(65,170,90,0.10)",

                border:
                  "1px solid rgba(80,190,110,0.25)",

                borderRadius:
                  "999px",

                fontSize:
                  "10px",

                fontWeight:
                  900,
              }}
            >
              {
                accountTypeLabel(
                  myLink.accountType
                )
              }
            </div>
          </div>


          <button
            type="button"
            onClick={
              () =>
                router.push(
                  "/"
                )
            }
            style={{
              width:
                "100%",

              height:
                "44px",

              marginTop:
                "18px",

              color:
                "#fff",

              background:
                "#292929",

              border:
                "1px solid #444",

              borderRadius:
                "9px",

              fontWeight:
                900,

              cursor:
                "pointer",
            }}
          >
            대시보드로 이동
          </button>
        </section>
      </main>
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main
      style={{
        minHeight:
          "100vh",

        padding:
          "40px 24px",

        background:
          "#050505",

        color:
          "#fff",
      }}
    >
      <div
        style={{
          width:
            "100%",

          maxWidth:
            "1100px",

          margin:
            "0 auto",
        }}
      >

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div
          style={{
            marginBottom:
              "24px",
          }}
        >
          <div
            style={{
              color:
                "#8d8d8d",

              fontSize:
                "10px",

              fontWeight:
                900,

              letterSpacing:
                "1.7px",
            }}
          >
            GAME ACCOUNT LINK
          </div>


          <h1
            style={{
              margin:
                "8px 0 0",

              fontSize:
                "30px",

              fontWeight:
                900,

              letterSpacing:
                "-1px",
            }}
          >
            게임 닉네임 연결
          </h1>


          <p
            style={{
              margin:
                "8px 0 0",

              color:
                "#aaa",

              fontSize:
                "12px",
            }}
          >
            Discord 계정과 실제 길드원을 최초 1회 연결합니다.
          </p>
        </div>



        {/* ================================================== */}
        {/* DISCORD INFO */}
        {/* ================================================== */}

        <section
          style={{
            padding:
              "18px",

            background:
              "#0d0d0d",

            border:
              "1px solid #292929",

            borderRadius:
              "12px",

            marginBottom:
              "14px",
          }}
        >
          <div
            style={{
              color:
                "#888",

              fontSize:
                "9px",

              fontWeight:
                900,
            }}
          >
            현재 Discord 계정
          </div>


          <div
            style={{
              marginTop:
                "6px",

              color:
                "#fff",

              fontSize:
                "15px",

              fontWeight:
                900,
            }}
          >
            {
              discordName ||
              "-"
            }
          </div>
        </section>



        {/* ================================================== */}
        {/* SEARCH */}
        {/* ================================================== */}

        <div
          style={{
            marginBottom:
              "14px",
          }}
        >
          <input
            type="text"
            value={
              search
            }
            onChange={
              event =>
                setSearch(
                  event.target.value
                )
            }
            placeholder="닉네임 / 길드 / 직업 / GID 검색"
            style={{
              width:
                "100%",

              height:
                "44px",

              boxSizing:
                "border-box",

              padding:
                "0 14px",

              color:
                "#fff",

              background:
                "#0b0b0b",

              border:
                "1px solid #303030",

              borderRadius:
                "9px",

              outline:
                "none",
            }}
          />
        </div>



        {/* ================================================== */}
        {/* LOADING */}
        {/* ================================================== */}

        {
          loading &&
          (
            <div
              style={{
                padding:
                  "50px",

                textAlign:
                  "center",

                color:
                  "#aaa",
              }}
            >
              길드원 정보를 불러오는 중...
            </div>
          )
        }



        {/* ================================================== */}
        {/* MEMBER LIST */}
        {/* ================================================== */}

        {
          !loading &&
          (
            <section
              style={{
                border:
                  "1px solid #292929",

                borderRadius:
                  "12px",

                overflow:
                  "hidden",

                background:
                  "#0b0b0b",
              }}
            >

              {
                filteredMembers.length ===
                  0
                  ? (
                    <div
                      style={{
                        padding:
                          "40px",

                        textAlign:
                          "center",

                        color:
                          "#888",
                      }}
                    >
                      검색 결과가 없습니다.
                    </div>
                  )
                  : (
                    filteredMembers.map(
                      member => {
                        const selected =
                          selectedGid ===
                          member.gid;


                        const badge =
                          guildBadgeStyle(
                            member.guild
                          );


                        return (
                          <button
                            key={
                              member.gid
                            }
                            type="button"
                            disabled={
                              member.full
                            }
                            onClick={
                              () =>
                                selectMember(
                                  member
                                )
                            }
                            style={{
                              width:
                                "100%",

                              minHeight:
                                "72px",

                              display:
                                "grid",

                              gridTemplateColumns:
                                "80px minmax(180px,1fr) 120px 140px 90px",

                              alignItems:
                                "center",

                              gap:
                                "10px",

                              padding:
                                "0 16px",

                              color:
                                "#fff",

                              background:
                                selected
                                  ? "#151515"
                                  : "#0d0d0d",

                              border:
                                "none",

                              borderBottom:
                                "1px solid #252525",

                              textAlign:
                                "left",

                              opacity:
                                member.full
                                  ? 0.48
                                  : 1,

                              cursor:
                                member.full
                                  ? "default"
                                  : "pointer",
                            }}
                          >

                            {/* GID */}

                            <div
                              style={{
                                color:
                                  "#888",

                                fontSize:
                                  "10px",

                                fontWeight:
                                  800,
                              }}
                            >
                              GID{" "}
                              {
                                member.gid
                              }
                            </div>


                            {/* 닉네임 */}

                            <div>
                              <div
                                style={{
                                  color:
                                    "#fff",

                                  fontSize:
                                    "14px",

                                  fontWeight:
                                    900,
                                }}
                              >
                                {
                                  member.nickname
                                }
                              </div>


                              <div
                                style={{
                                  marginTop:
                                    "5px",

                                  color:
                                    "#999",

                                  fontSize:
                                    "10px",
                                }}
                              >
                                {
                                  member.job ||
                                  "직업 미입력"
                                }
                              </div>
                            </div>


                            {/* 길드 */}

                            <div>
                              <span
                                style={{
                                  display:
                                    "inline-block",

                                  padding:
                                    "5px 8px",

                                  borderRadius:
                                    "999px",

                                  fontSize:
                                    "10px",

                                  fontWeight:
                                    900,

                                  ...badge,
                                }}
                              >
                                {
                                  member.guild ||
                                  "미지정"
                                }
                              </span>
                            </div>


                            {/* 성장력 */}

                            <div
                              style={{
                                color:
                                  "#ccc",

                                fontSize:
                                  "11px",

                                fontWeight:
                                  800,
                              }}
                            >
                              {
                                member.growthPower ||
                                "-"
                              }
                            </div>


                            {/* 연결상태 */}

                            <div
                              style={{
                                textAlign:
                                  "right",
                              }}
                            >
                              <strong
                                style={{
                                  display:
                                    "block",

                                  color:
                                    member.full
                                      ? "#ffaaaa"
                                      : member.discordLinkCount ===
                                        1
                                        ? "#ffd48e"
                                        : "#bceec8",

                                  fontSize:
                                    "12px",
                                }}
                              >
                                🔗{" "}
                                {
                                  member.discordLinkCount
                                }
                                /
                                {
                                  member.discordLinkMax
                                }
                              </strong>


                              <span
                                style={{
                                  display:
                                    "block",

                                  marginTop:
                                    "4px",

                                  color:
                                    "#888",

                                  fontSize:
                                    "9px",
                                }}
                              >
                                {
                                  member.full
                                    ? "연결완료"
                                    : selected
                                      ? "선택됨"
                                      : "선택"
                                }
                              </span>
                            </div>

                          </button>
                        );
                      }
                    )
                  )
              }

            </section>
          )
        }



        {/* ================================================== */}
        {/* SELECTED */}
        {/* ================================================== */}

        {
          selectedMember &&
          !selectedMember.full &&
          (
            <section
              style={{
                marginTop:
                  "16px",

                padding:
                  "20px",

                background:
                  "#0d0d0d",

                border:
                  "1px solid #333",

                borderRadius:
                  "12px",
              }}
            >
              <div
                style={{
                  color:
                    "#888",

                  fontSize:
                    "9px",

                  fontWeight:
                    900,
                }}
              >
                선택한 길드원
              </div>


              <div
                style={{
                  marginTop:
                    "7px",

                  color:
                    "#fff",

                  fontSize:
                    "18px",

                  fontWeight:
                    900,
                }}
              >
                {
                  selectedMember.nickname
                }
              </div>


              <div
                style={{
                  marginTop:
                    "5px",

                  color:
                    "#aaa",

                  fontSize:
                    "11px",
                }}
              >
                {
                  selectedMember.guild
                }

                {" · "}

                {
                  selectedMember.job ||
                  "-"
                }

                {" · "}

                GID{" "}
                {
                  selectedMember.gid
                }
              </div>



              {/* ============================================= */}
              {/* 첫 번째 계정 */}
              {/* ============================================= */}

              {
                selectedMember.discordLinkCount ===
                  0 &&
                (
                  <div
                    style={{
                      marginTop:
                        "16px",

                      padding:
                        "13px",

                      color:
                        "#bceec8",

                      background:
                        "rgba(50,160,80,0.07)",

                      border:
                        "1px solid rgba(70,190,100,0.20)",

                      borderRadius:
                        "8px",

                      fontSize:
                        "11px",
                    }}
                  >
                    첫 번째 Discord 계정이므로
                    자동으로 <strong>본계정</strong>으로 연결됩니다.
                  </div>
                )
              }



              {/* ============================================= */}
              {/* 두 번째 계정 */}
              {/* ============================================= */}

              {
                selectedMember.discordLinkCount ===
                  1 &&
                (
                  <div
                    style={{
                      marginTop:
                        "16px",

                      padding:
                        "15px",

                      background:
                        "#111",

                      border:
                        "1px solid #2b2b2b",

                      borderRadius:
                        "9px",
                    }}
                  >

                    <label
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap:
                          "8px",

                        color:
                          "#eee",

                        fontSize:
                          "11px",

                        fontWeight:
                          900,

                        cursor:
                          "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          additionalInput
                        }
                        onChange={
                          event =>
                            setAdditionalInput(
                              event.target.checked
                            )
                        }
                      />

                      추가입력
                    </label>



                    {
                      additionalInput &&
                      (
                        <div
                          style={{
                            display:
                              "flex",

                            gap:
                              "22px",

                            marginTop:
                              "14px",
                          }}
                        >

                          <label
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap:
                                "7px",

                              color:
                                "#ddd",

                              fontSize:
                                "11px",

                              cursor:
                                "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name="additional-type"
                              checked={
                                additionalType ===
                                "sub"
                              }
                              onChange={
                                () =>
                                  setAdditionalType(
                                    "sub"
                                  )
                              }
                            />

                            부주
                          </label>


                          <label
                            style={{
                              display:
                                "flex",

                              alignItems:
                                "center",

                              gap:
                                "7px",

                              color:
                                "#ddd",

                              fontSize:
                                "11px",

                              cursor:
                                "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name="additional-type"
                              checked={
                                additionalType ===
                                "discord_alt"
                              }
                              onChange={
                                () =>
                                  setAdditionalType(
                                    "discord_alt"
                                  )
                              }
                            />

                            디코부계정
                          </label>

                        </div>
                      )
                    }

                  </div>
                )
              }



              {/* ============================================= */}
              {/* CONNECT BUTTON */}
              {/* ============================================= */}

              <button
                type="button"
                onClick={
                  submitLink
                }
                disabled={
                  saving
                }
                style={{
                  width:
                    "100%",

                  height:
                    "45px",

                  marginTop:
                    "16px",

                  color:
                    "#fff",

                  background:
                    "#292929",

                  border:
                    "1px solid #454545",

                  borderRadius:
                    "9px",

                  fontSize:
                    "12px",

                  fontWeight:
                    900,

                  cursor:
                    saving
                      ? "default"
                      : "pointer",
                }}
              >
                {
                  saving
                    ? "연결 중..."
                    : selectedMember.discordLinkCount ===
                      0
                      ? "본계정으로 연결"
                      : "추가 계정 연결"
                }
              </button>

            </section>
          )
        }



        {/* ================================================== */}
        {/* MESSAGE */}
        {/* ================================================== */}

        {
          message &&
          (
            <div
              style={{
                marginTop:
                  "14px",

                padding:
                  "12px 14px",

                color:
                  "#bceec8",

                background:
                  "rgba(50,160,80,0.08)",

                border:
                  "1px solid rgba(70,190,100,0.20)",

                borderRadius:
                  "9px",

                fontSize:
                  "11px",

                fontWeight:
                  800,
              }}
            >
              {
                message
              }
            </div>
          )
        }


        {
          error &&
          (
            <div
              style={{
                marginTop:
                  "14px",

                padding:
                  "12px 14px",

                color:
                  "#efaaaa",

                background:
                  "rgba(180,45,45,0.08)",

                border:
                  "1px solid rgba(210,70,70,0.22)",

                borderRadius:
                  "9px",

                fontSize:
                  "11px",

                fontWeight:
                  800,
              }}
            >
              {
                error
              }
            </div>
          )
        }

      </div>
    </main>
  );
}