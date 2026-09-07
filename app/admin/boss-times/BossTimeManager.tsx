"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


type Boss = {
  id: string;
  name: string;
  aliases: string[];
  level: number | null;
  spawnType:
    | "interval"
    | "fixed";
  intervalMinutes: number | null;
  fixedTimes: string[];
  enabled: boolean;
  sortOrder: number;
  description: string;
  lastSpawnAt: string | null;
  nextSpawnAt: string | null;
  stateSource:
    | "manual"
    | "mingbot"
    | "system"
    | null;
  stateUpdatedAt: string | null;
  updatedAt: string;
};


type BotStatus = {
  status:
    | "online"
    | "delayed"
    | "offline"
    | "unknown";

  online: boolean;

  ageSeconds:
    number |
    null;

  heartbeat:
    | {
        instanceKey: string;
        botUserId:
          string |
          null;
        botName:
          string |
          null;
        version:
          string |
          null;
        guildCount: number;
        heartbeatAt: string;
        startedAt:
          string |
          null;
        updatedAt: string;
      }
    | null;
};


type FormState = {
  id: string;
  name: string;
  level: string;
  spawnType:
    | "interval"
    | "fixed";
  intervalMinutes: string;
  fixedTimes: string;
  aliases: string;
  description: string;
  sortOrder: string;
  nextSpawnAt: string;
};


const emptyForm:
  FormState = {
    id: "",
    name: "",
    level: "",
    spawnType:
      "interval",
    intervalMinutes:
      "480",
    fixedTimes:
      "",
    aliases:
      "",
    description:
      "",
    sortOrder:
      "100",
    nextSpawnAt:
      "",
  };


function toLocalInput(
  value:
    string |
    null
) {

  if (
    !value
  ) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const offset =
    date.getTimezoneOffset() *
    60000;


  return new Date(
    date.getTime() -
    offset
  )
    .toISOString()
    .slice(
      0,
      16
    );
}


function formatDateTime(
  value:
    string |
    null
) {

  if (
    !value
  ) {
    return "-";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }


  return date
    .toLocaleString(
      "ko-KR",
      {
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hour12:
          false,
      }
    );
}




function botStatusLabel(
  status: BotStatus
) {

  if (
    status.status ===
    "online"
  ) {
    return "밍봇 온라인";
  }


  if (
    status.status ===
    "delayed"
  ) {
    return "밍봇 응답 지연";
  }


  if (
    status.status ===
    "offline"
  ) {
    return "밍봇 오프라인";
  }


  return "밍봇 상태 미확인";
}


function heartbeatAgeText(
  seconds:
    number |
    null
) {

  if (
    seconds === null
  ) {
    return "heartbeat 기록 없음";
  }


  if (
    seconds <
    60
  ) {
    return `${seconds}초 전`;
  }


  const minutes =
    Math.floor(
      seconds /
      60
    );


  if (
    minutes <
    60
  ) {
    return `${minutes}분 전`;
  }


  const hours =
    Math.floor(
      minutes /
      60
    );


  return `${hours}시간 전`;
}


function syncStatusText(
  boss: Boss
) {

  if (
    !boss.enabled
  ) {
    return "비활성";
  }


  if (
    !boss.stateUpdatedAt
  ) {
    return "설정만 등록";
  }


  const updated =
    new Date(
      boss.stateUpdatedAt
    );


  if (
    Number.isNaN(
      updated.getTime()
    )
  ) {
    return "상태 미확인";
  }


  const diffMinutes =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          updated.getTime()
        ) /
        60000
      )
    );


  if (
    boss.stateSource ===
    "mingbot"
  ) {
    return diffMinutes <= 2
      ? "밍봇 최근 갱신"
      : `밍봇 갱신 ${diffMinutes}분 전`;
  }


  if (
    boss.stateSource ===
    "manual"
  ) {
    return "관리자 갱신";
  }


  return "시스템 갱신";
}


function cycleText(
  boss: Boss
) {

  if (
    boss.spawnType ===
    "fixed"
  ) {
    return boss.fixedTimes
      .join(
        " · "
      );
  }


  const minutes =
    Number(
      boss.intervalMinutes ||
      0
    );


  if (
    minutes <=
    0
  ) {
    return "-";
  }


  if (
    minutes % 60 ===
    0
  ) {
    return `${minutes / 60}시간`;
  }


  return `${minutes}분`;
}


export default function BossTimeManager() {

  const [
    bosses,
    setBosses,
  ] =
    useState<Boss[]>([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


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
    error,
    setError,
  ] =
    useState("");


  const [
    botStatus,
    setBotStatus,
  ] =
    useState<BotStatus>({
      status:
        "unknown",

      online:
        false,

      ageSeconds:
        null,

      heartbeat:
        null,
    });


  const [
    showDisabled,
    setShowDisabled,
  ] =
    useState(false);


  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm
    );


  const editing =
    Boolean(
      form.id
    );


  async function loadBosses() {

    setLoading(
      true
    );

    setError("");


    try {

      const response =
        await fetch(
          "/api/admin/boss-times",
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
          "보스 정보를 불러오지 못했습니다."
        );
      }


      setBosses(
        Array.isArray(
          data.bosses
        )
          ? data.bosses
          : []
      );


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "보스 정보를 불러오지 못했습니다."
      );


    } finally {

      setLoading(
        false
      );
    }
  }


  async function loadBotStatus() {

    try {

      const response =
        await fetch(
          "/api/admin/mingbot-status",
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
          "밍봇 상태 조회 실패"
        );
      }


      setBotStatus({
        status:
          data.status ||
          "unknown",

        online:
          Boolean(
            data.online
          ),

        ageSeconds:
          typeof data.ageSeconds ===
          "number"
            ? data.ageSeconds
            : null,

        heartbeat:
          data.heartbeat ||
          null,
      });


    } catch (
      error
    ) {

      console.error(
        "[밍봇 상태 조회]",
        error
      );


      setBotStatus(
        current => ({
          ...current,

          status:
            "unknown",

          online:
            false,
        })
      );
    }
  }


  useEffect(
    () => {

      loadBosses();
      loadBotStatus();


      const timer =
        window.setInterval(
          loadBotStatus,
          10000
        );


      return () => {

        window.clearInterval(
          timer
        );
      };

    },
    []
  );


  const visibleBosses =
    useMemo(
      () =>
        bosses.filter(
          boss =>
            showDisabled ||
            boss.enabled
        ),
      [
        bosses,
        showDisabled,
      ]
    );


  function updateForm(
    key:
      keyof FormState,
    value: string
  ) {

    setForm(
      current => ({
        ...current,
        [key]:
          value,
      })
    );
  }


  function resetForm() {

    setForm(
      emptyForm
    );

    setMessage("");
    setError("");
  }


  function editBoss(
    boss: Boss
  ) {

    setForm({
      id:
        boss.id,

      name:
        boss.name,

      level:
        boss.level ===
        null
          ? ""
          : String(
              boss.level
            ),

      spawnType:
        boss.spawnType,

      intervalMinutes:
        boss.intervalMinutes ===
        null
          ? "480"
          : String(
              boss.intervalMinutes
            ),

      fixedTimes:
        boss.fixedTimes
          .join(
            ","
          ),

      aliases:
        boss.aliases
          .join(
            ","
          ),

      description:
        boss.description,

      sortOrder:
        String(
          boss.sortOrder
        ),

      nextSpawnAt:
        toLocalInput(
          boss.nextSpawnAt
        ),
    });


    setMessage("");
    setError("");


    window.scrollTo({
      top: 0,
      behavior:
        "smooth",
    });
  }


  function buildPayload() {

    return {
      id:
        form.id,

      name:
        form.name.trim(),

      level:
        form.level.trim()
          ? Number(
              form.level
            )
          : null,

      spawnType:
        form.spawnType,

      intervalMinutes:
        form.spawnType ===
        "interval"
          ? Number(
              form.intervalMinutes
            )
          : null,

      fixedTimes:
        form.spawnType ===
        "fixed"
          ? form.fixedTimes
              .split(",")
              .map(
                value =>
                  value.trim()
              )
              .filter(
                Boolean
              )
          : [],

      aliases:
        form.aliases
          .split(",")
          .map(
            value =>
              value.trim()
          )
          .filter(
            Boolean
          ),

      description:
        form.description.trim(),

      sortOrder:
        Number(
          form.sortOrder ||
          0
        ),

      nextSpawnAt:
        form.nextSpawnAt
          ? new Date(
              form.nextSpawnAt
            ).toISOString()
          : null,

      enabled:
        true,
    };
  }


  async function saveBoss() {

    setSaving(
      true
    );

    setMessage("");
    setError("");


    try {

      const response =
        await fetch(
          "/api/admin/boss-times",
          {
            method:
              editing
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                buildPayload()
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
          "저장에 실패했습니다."
        );
      }


      setMessage(
        data.message ||
        "저장했습니다."
      );


      setForm(
        emptyForm
      );


      await loadBosses();


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "저장에 실패했습니다."
      );


    } finally {

      setSaving(
        false
      );
    }
  }


  async function restoreBoss(
    boss: Boss
  ) {

    const confirmed =
      window.confirm(
        `${boss.name}을(를) 다시 활성화할까요?\n\n` +
        "웹 보스타임에 다시 표시되고 밍봇에도 자동 반영됩니다."
      );


    if (
      !confirmed
    ) {
      return;
    }


    setSaving(
      true
    );

    setMessage("");
    setError("");


    try {

      const response =
        await fetch(
          "/api/admin/boss-times",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  boss.id,

                action:
                  "restore",
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
          "보스 복구에 실패했습니다."
        );
      }


      setMessage(
        data.message
      );


      await loadBosses();


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "보스 복구에 실패했습니다."
      );


    } finally {

      setSaving(
        false
      );
    }
  }


  async function disableBoss(
    boss: Boss
  ) {

    const confirmed =
      window.confirm(
        `${boss.name}을(를) 비활성화할까요?\n\n` +
        "웹 보스타임에서 숨겨지고 밍봇에서도 자동 제거됩니다.\n" +
        "기존 이벤트 이력은 보존됩니다."
      );


    if (
      !confirmed
    ) {
      return;
    }


    setSaving(
      true
    );

    setMessage("");
    setError("");


    try {

      const response =
        await fetch(
          "/api/admin/boss-times",
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  boss.id,
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
          "보스 비활성화에 실패했습니다."
        );
      }


      setMessage(
        data.message
      );


      await loadBosses();


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "보스 비활성화에 실패했습니다."
      );


    } finally {

      setSaving(
        false
      );
    }
  }


  async function moveBoss(
    boss: Boss,
    direction:
      | "up"
      | "down"
  ) {

    const active =
      bosses
        .filter(
          item =>
            item.enabled
        )
        .sort(
          (
            a,
            b
          ) =>
            a.sortOrder -
            b.sortOrder
        );


    const index =
      active.findIndex(
        item =>
          item.id ===
          boss.id
      );


    if (
      index < 0
    ) {
      return;
    }


    const targetIndex =
      direction ===
      "up"
        ? index - 1
        : index + 1;


    if (
      targetIndex < 0 ||
      targetIndex >=
        active.length
    ) {
      return;
    }


    const target =
      active[
        targetIndex
      ];


    setSaving(
      true
    );

    setMessage("");
    setError("");


    try {

      const currentPayload = {
        id:
          boss.id,

        name:
          boss.name,

        level:
          boss.level,

        spawnType:
          boss.spawnType,

        intervalMinutes:
          boss.intervalMinutes,

        fixedTimes:
          boss.fixedTimes,

        aliases:
          boss.aliases,

        description:
          boss.description,

        sortOrder:
          target.sortOrder,

        nextSpawnAt:
          boss.nextSpawnAt,

        enabled:
          boss.enabled,
      };


      const targetPayload = {
        id:
          target.id,

        name:
          target.name,

        level:
          target.level,

        spawnType:
          target.spawnType,

        intervalMinutes:
          target.intervalMinutes,

        fixedTimes:
          target.fixedTimes,

        aliases:
          target.aliases,

        description:
          target.description,

        sortOrder:
          boss.sortOrder,

        nextSpawnAt:
          target.nextSpawnAt,

        enabled:
          target.enabled,
      };


      for (
        const payload of
        [
          currentPayload,
          targetPayload,
        ]
      ) {

        const response =
          await fetch(
            "/api/admin/boss-times",
            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  payload
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
            "보스 순서 변경에 실패했습니다."
          );
        }
      }


      setMessage(
        "보스 표시 순서를 변경했습니다."
      );


      await loadBosses();


    } catch (
      error
    ) {

      setError(
        error instanceof Error
          ? error.message
          : "보스 순서 변경에 실패했습니다."
      );


    } finally {

      setSaving(
        false
      );
    }
  }


  return (

    <main
      style={{
        minHeight:
          "calc(100vh - 70px)",

        background:
          "#050505",

        color:
          "#f4f4f4",

        padding:
          "34px 22px 70px",
      }}
    >

      <div
        style={{
          width:
            "min(1320px, 100%)",

          margin:
            "0 auto",
        }}
      >


        <div
          style={{
            display:
              "flex",

            alignItems:
              "flex-end",

            justifyContent:
              "space-between",

            gap:
              "20px",

            marginBottom:
              "24px",
          }}
        >

          <div>

            <div
              style={{
                color:
                  "#9a9a9a",

                fontSize:
                  "10px",

                fontWeight:
                  900,

                letterSpacing:
                  "1.7px",
              }}
            >
              BOSS TIME MANAGEMENT
            </div>


            <h1
              style={{
                margin:
                  "7px 0 0",

                fontSize:
                  "32px",

                fontWeight:
                  900,

                letterSpacing:
                  "-1.3px",
              }}
            >
              ⏰ 보스타임 관리
            </h1>


            <p
              style={{
                margin:
                  "8px 0 0",

                color:
                  "#aaa",

                fontSize:
                  "12px",

                lineHeight:
                  1.7,
              }}
            >
              여기서 수정한 보스 설정은 Supabase에 저장되고 밍봇이 최대 약 1분 안에 자동 반영합니다.
            </p>

          </div>


          <button
            type="button"
            onClick={
              resetForm
            }
            style={{
              height:
                "40px",

              padding:
                "0 15px",

              color:
                "#d7d7d7",

              background:
                "#111",

              border:
                "1px solid #333",

              borderRadius:
                "9px",

              fontWeight:
                850,

              cursor:
                "pointer",
            }}
          >
            + 새 보스
          </button>

        </div>


        <section
          style={{
            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            gap:
              "16px",

            padding:
              "15px 18px",

            marginBottom:
              "18px",

            background:
              "#0d0d0d",

            border:
              botStatus.status ===
              "online"
                ? "1px solid rgba(64,190,105,.30)"
                : botStatus.status ===
                  "delayed"
                  ? "1px solid rgba(210,165,70,.30)"
                  : botStatus.status ===
                    "offline"
                    ? "1px solid rgba(210,75,75,.30)"
                    : "1px solid #303030",

            borderRadius:
              "12px",
          }}
        >

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                "12px",
            }}
          >

            <span
              style={{
                width:
                  "11px",

                height:
                  "11px",

                flexShrink:
                  0,

                borderRadius:
                  "50%",

                background:
                  botStatus.status ===
                  "online"
                    ? "#53d77b"
                    : botStatus.status ===
                      "delayed"
                      ? "#d9b45e"
                      : botStatus.status ===
                        "offline"
                        ? "#de6868"
                        : "#777",

                boxShadow:
                  botStatus.status ===
                  "online"
                    ? "0 0 15px rgba(83,215,123,.48)"
                    : "none",
              }}
            />

            <div>

              <strong
                style={{
                  display:
                    "block",

                  color:
                    "#f3f3f3",

                  fontSize:
                    "12px",

                  fontWeight:
                    900,
                }}
              >
                {
                  botStatusLabel(
                    botStatus
                  )
                }
              </strong>


              <small
                style={{
                  display:
                    "block",

                  marginTop:
                    "4px",

                  color:
                    "#8f8f8f",

                  fontSize:
                    "9px",
                }}
              >
                마지막 heartbeat · {
                  heartbeatAgeText(
                    botStatus.ageSeconds
                  )
                }
              </small>

            </div>

          </div>


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
                  "#cfcfcf",

                fontSize:
                  "10px",

                fontWeight:
                  850,
              }}
            >
              {
                botStatus.heartbeat
                  ?.version
                  ? `v${botStatus.heartbeat.version}`
                  : "버전 미확인"
              }
            </strong>


            <small
              style={{
                display:
                  "block",

                marginTop:
                  "4px",

                color:
                  "#777",

                fontSize:
                  "8px",
              }}
            >
              {
                botStatus.heartbeat
                  ?.botName ||
                "밍봇"
              }
              {" · "}
              서버 {
                botStatus.heartbeat
                  ?.guildCount ??
                "-"
              }개
            </small>

          </div>

        </section>


        {
          message &&
          (
            <div
              style={{
                marginBottom:
                  "16px",

                padding:
                  "12px 14px",

                color:
                  "#a9e0b7",

                background:
                  "rgba(69, 170, 100, .07)",

                border:
                  "1px solid rgba(69, 170, 100, .24)",

                borderRadius:
                  "9px",

                fontSize:
                  "11px",

                fontWeight:
                  750,
              }}
            >
              ✓ {message}
            </div>
          )
        }


        {
          error &&
          (
            <div
              style={{
                marginBottom:
                  "16px",

                padding:
                  "12px 14px",

                color:
                  "#f0abab",

                background:
                  "rgba(200, 70, 70, .07)",

                border:
                  "1px solid rgba(200, 70, 70, .24)",

                borderRadius:
                  "9px",

                fontSize:
                  "11px",

                fontWeight:
                  750,
              }}
            >
              ⚠️ {error}
            </div>
          )
        }


        <section
          style={{
            padding:
              "20px",

            background:
              "#0d0d0d",

            border:
              "1px solid #2c2c2c",

            borderRadius:
              "14px",

            marginBottom:
              "24px",
          }}
        >

          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              marginBottom:
                "17px",
            }}
          >

            <div>
              <strong
                style={{
                  fontSize:
                    "15px",

                  fontWeight:
                    900,
                }}
              >
                {
                  editing
                    ? "보스 수정"
                    : "새 보스 등록"
                }
              </strong>

              <div
                style={{
                  marginTop:
                    "4px",

                  color:
                    "#929292",

                  fontSize:
                    "10px",
                }}
              >
                일반젠은 컷 이후 주기, 고정젠은 매일 정해진 시간을 기준으로 동작합니다.
              </div>
            </div>


            {
              editing &&
              (
                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  style={{
                    color:
                      "#aaa",

                    background:
                      "transparent",

                    border:
                      0,

                    cursor:
                      "pointer",

                    fontSize:
                      "11px",
                  }}
                >
                  수정 취소
                </button>
              )
            }

          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1.3fr .55fr .8fr .9fr",

              gap:
                "10px",
            }}
          >

            <Field
              label="보스 이름"
              value={
                form.name
              }
              onChange={
                value =>
                  updateForm(
                    "name",
                    value
                  )
              }
              placeholder="예: 트라손"
            />


            <Field
              label="레벨"
              value={
                form.level
              }
              onChange={
                value =>
                  updateForm(
                    "level",
                    value
                  )
              }
              placeholder="40"
              type="number"
            />


            <label
              style={
                fieldWrapStyle
              }
            >
              <span
                style={
                  labelStyle
                }
              >
                출현 방식
              </span>

              <select
                value={
                  form.spawnType
                }
                onChange={
                  event =>
                    updateForm(
                      "spawnType",
                      event.target
                        .value
                    )
                }
                style={
                  inputStyle
                }
              >
                <option value="interval">
                  일반젠
                </option>

                <option value="fixed">
                  고정젠
                </option>
              </select>
            </label>


            <Field
              label="정렬 순서"
              value={
                form.sortOrder
              }
              onChange={
                value =>
                  updateForm(
                    "sortOrder",
                    value
                  )
              }
              placeholder="100"
              type="number"
            />

          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              gap:
                "10px",

              marginTop:
                "10px",
            }}
          >

            {
              form.spawnType ===
              "interval"
                ? (
                    <Field
                      label="젠 주기 (분)"
                      value={
                        form.intervalMinutes
                      }
                      onChange={
                        value =>
                          updateForm(
                            "intervalMinutes",
                            value
                          )
                      }
                      placeholder="480"
                      type="number"
                    />
                  )
                : (
                    <Field
                      label="고정젠 시간"
                      value={
                        form.fixedTimes
                      }
                      onChange={
                        value =>
                          updateForm(
                            "fixedTimes",
                            value
                          )
                      }
                      placeholder="12:00,20:00"
                    />
                  )
            }


            <Field
              label="줄임말 / 별칭"
              value={
                form.aliases
              }
              onChange={
                value =>
                  updateForm(
                    "aliases",
                    value
                  )
              }
              placeholder="트라,트라손"
            />

          </div>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              gap:
                "10px",

              marginTop:
                "10px",
            }}
          >

            <Field
              label="다음 소환시간 (선택)"
              value={
                form.nextSpawnAt
              }
              onChange={
                value =>
                  updateForm(
                    "nextSpawnAt",
                    value
                  )
              }
              type="datetime-local"
            />


            <Field
              label="설명"
              value={
                form.description
              }
              onChange={
                value =>
                  updateForm(
                    "description",
                    value
                  )
              }
              placeholder="운영 메모"
            />

          </div>


          <div
            style={{
              marginTop:
                "16px",

              display:
                "flex",

              justifyContent:
                "flex-end",

              gap:
                "8px",
            }}
          >

            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                saveBoss
              }
              style={{
                minWidth:
                  "120px",

                height:
                  "42px",

                padding:
                  "0 18px",

                color:
                  saving
                    ? "#888"
                    : "#fff",

                background:
                  saving
                    ? "#242424"
                    : "#5865f2",

                border:
                  0,

                borderRadius:
                  "9px",

                fontSize:
                  "11px",

                fontWeight:
                  900,

                cursor:
                  saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {
                saving
                  ? "처리 중..."
                  : editing
                    ? "수정 저장"
                    : "보스 등록"
              }
            </button>

          </div>

        </section>


        <section
          style={{
            background:
              "#0d0d0d",

            border:
              "1px solid #2c2c2c",

            borderRadius:
              "14px",

            overflow:
              "hidden",
          }}
        >

          <div
            style={{
              minHeight:
                "58px",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "space-between",

              gap:
                "12px",

              padding:
                "0 18px",

              borderBottom:
                "1px solid #292929",
            }}
          >

            <div>
              <strong>
                등록 보스
              </strong>

              <span
                style={{
                  marginLeft:
                    "8px",

                  color:
                    "#929292",

                  fontSize:
                    "10px",
                }}
              >
                활성 {
                  bosses.filter(
                    boss =>
                      boss.enabled
                  ).length
                }개
              </span>
            </div>


            <label
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "7px",

                color:
                  "#aaa",

                fontSize:
                  "10px",

                cursor:
                  "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={
                  showDisabled
                }
                onChange={
                  event =>
                    setShowDisabled(
                      event.target.checked
                    )
                }
              />

              비활성 포함
            </label>

          </div>


          {
            loading
              ? (
                  <div
                    style={
                      emptyStyle
                    }
                  >
                    보스 정보를 불러오는 중입니다.
                  </div>
                )
              : visibleBosses.length ===
                0
                ? (
                    <div
                      style={
                        emptyStyle
                      }
                    >
                      등록된 보스가 없습니다.
                    </div>
                  )
                : (
                    <div
                      style={{
                        overflowX:
                          "auto",
                      }}
                    >

                      <div
                        style={{
                          minWidth:
                            "980px",
                        }}
                      >

                        <div
                          style={{
                            display:
                              "grid",

                            gridTemplateColumns:
                              "80px 1.2fr 80px 105px 125px 155px 145px 190px",

                            gap:
                              "10px",

                            alignItems:
                              "center",

                            minHeight:
                              "42px",

                            padding:
                              "0 16px",

                            color:
                              "#929292",

                            background:
                              "#131313",

                            fontSize:
                              "9px",

                            fontWeight:
                              850,
                          }}
                        >
                          <span>상태</span>
                          <span>보스</span>
                          <span>레벨</span>
                          <span>방식</span>
                          <span>젠 주기</span>
                          <span>다음 소환</span>
                          <span>연동 상태</span>
                          <span>관리</span>
                        </div>


                        {
                          visibleBosses.map(
                            boss => (
                              <div
                                key={
                                  boss.id
                                }
                                style={{
                                  display:
                                    "grid",

                                  gridTemplateColumns:
                                    "80px 1.2fr 80px 105px 125px 155px 145px 190px",

                                  gap:
                                    "10px",

                                  alignItems:
                                    "center",

                                  minHeight:
                                    "65px",

                                  padding:
                                    "0 16px",

                                  borderTop:
                                    "1px solid #242424",

                                  color:
                                    boss.enabled
                                      ? "#d5d5d5"
                                      : "#777",

                                  fontSize:
                                    "11px",
                                }}
                              >

                                <span
                                  style={{
                                    width:
                                      "fit-content",

                                    padding:
                                      "4px 7px",

                                    color:
                                      boss.enabled
                                        ? "#9fe5b3"
                                        : "#aaa",

                                    background:
                                      boss.enabled
                                        ? "rgba(55,180,95,.07)"
                                        : "#171717",

                                    border:
                                      boss.enabled
                                        ? "1px solid rgba(55,180,95,.23)"
                                        : "1px solid #333",

                                    borderRadius:
                                      "999px",

                                    fontSize:
                                      "8px",

                                    fontWeight:
                                      900,
                                  }}
                                >
                                  {
                                    boss.enabled
                                      ? "활성"
                                      : "비활성"
                                  }
                                </span>


                                <div>
                                  <strong
                                    style={{
                                      color:
                                        boss.enabled
                                          ? "#fff"
                                          : "#888",

                                      fontSize:
                                        "12px",

                                      fontWeight:
                                        900,
                                    }}
                                  >
                                    {boss.name}
                                  </strong>

                                  {
                                    boss.aliases.length >
                                    0 &&
                                    (
                                      <small
                                        style={{
                                          display:
                                            "block",

                                          marginTop:
                                            "4px",

                                          color:
                                            "#858585",

                                          fontSize:
                                            "9px",
                                        }}
                                      >
                                        {boss.aliases.join(", ")}
                                      </small>
                                    )
                                  }
                                </div>


                                <span>
                                  {
                                    boss.level
                                      ? `Lv.${boss.level}`
                                      : "-"
                                  }
                                </span>


                                <span>
                                  {
                                    boss.spawnType ===
                                    "fixed"
                                      ? "고정젠"
                                      : "일반젠"
                                  }
                                </span>


                                <strong
                                  style={{
                                    color:
                                      "#e4e4e4",

                                    fontWeight:
                                      850,
                                  }}
                                >
                                  {
                                    cycleText(
                                      boss
                                    )
                                  }
                                </strong>


                                <div>
                                  <strong
                                    style={{
                                      color:
                                        boss.nextSpawnAt
                                          ? "#ffffff"
                                          : "#888",

                                      fontSize:
                                        "11px",
                                    }}
                                  >
                                    {
                                      formatDateTime(
                                        boss.nextSpawnAt
                                      )
                                    }
                                  </strong>

                                  {
                                    boss.stateSource &&
                                    (
                                      <small
                                        style={{
                                          display:
                                            "block",

                                          marginTop:
                                            "3px",

                                          color:
                                            "#777",

                                          fontSize:
                                            "8px",
                                        }}
                                      >
                                        {
                                          boss.stateSource ===
                                          "mingbot"
                                            ? "밍봇 갱신"
                                            : boss.stateSource ===
                                              "manual"
                                              ? "관리자 갱신"
                                              : "시스템 갱신"
                                        }
                                      </small>
                                    )
                                  }
                                </div>


                                <div>
                                  <strong
                                    style={{
                                      color:
                                        boss.stateSource ===
                                        "mingbot"
                                          ? "#9fe5b3"
                                          : "#d0d0d0",

                                      fontSize:
                                        "10px",

                                      fontWeight:
                                        850,
                                    }}
                                  >
                                    {
                                      syncStatusText(
                                        boss
                                      )
                                    }
                                  </strong>

                                  <small
                                    style={{
                                      display:
                                        "block",

                                      marginTop:
                                        "3px",

                                      color:
                                        "#777",

                                      fontSize:
                                        "8px",
                                    }}
                                  >
                                    {
                                      boss.stateUpdatedAt
                                        ? formatDateTime(
                                            boss.stateUpdatedAt
                                          )
                                        : "상태 기록 없음"
                                    }
                                  </small>
                                </div>


                                <div
                                  style={{
                                    display:
                                      "flex",

                                    gap:
                                      "5px",

                                    flexWrap:
                                      "wrap",
                                  }}
                                >

                                  {
                                    boss.enabled &&
                                    (
                                      <>
                                        <button
                                          type="button"
                                          disabled={
                                            saving
                                          }
                                          onClick={
                                            () =>
                                              moveBoss(
                                                boss,
                                                "up"
                                              )
                                          }
                                          title="위로"
                                          style={
                                            iconButtonStyle
                                          }
                                        >
                                          ↑
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            saving
                                          }
                                          onClick={
                                            () =>
                                              moveBoss(
                                                boss,
                                                "down"
                                              )
                                          }
                                          title="아래로"
                                          style={
                                            iconButtonStyle
                                          }
                                        >
                                          ↓
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            saving
                                          }
                                          onClick={
                                            () =>
                                              editBoss(
                                                boss
                                              )
                                          }
                                          style={
                                            smallButtonStyle
                                          }
                                        >
                                          수정
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            saving
                                          }
                                          onClick={
                                            () =>
                                              disableBoss(
                                                boss
                                              )
                                          }
                                          style={{
                                            ...smallButtonStyle,

                                            color:
                                              "#e7a1a1",

                                            borderColor:
                                              "rgba(190,70,70,.32)",
                                          }}
                                        >
                                          삭제
                                        </button>
                                      </>
                                    )
                                  }


                                  {
                                    !boss.enabled &&
                                    (
                                      <button
                                        type="button"
                                        disabled={
                                          saving
                                        }
                                        onClick={
                                          () =>
                                            restoreBoss(
                                              boss
                                            )
                                        }
                                        style={{
                                          ...smallButtonStyle,

                                          color:
                                            "#a9e0b7",

                                          borderColor:
                                            "rgba(69,170,100,.28)",
                                        }}
                                      >
                                        복구
                                      </button>
                                    )
                                  }

                                </div>

                              </div>
                            )
                          )
                        }

                      </div>

                    </div>
                  )
          }

        </section>

      </div>

    </main>
  );
}


const fieldWrapStyle:
  React.CSSProperties = {
    display:
      "flex",

    flexDirection:
      "column",

    gap:
      "6px",
  };


const labelStyle:
  React.CSSProperties = {
    color:
      "#aaa",

    fontSize:
      "9px",

    fontWeight:
      800,
  };


const inputStyle:
  React.CSSProperties = {
    width:
      "100%",

    height:
      "40px",

    padding:
      "0 11px",

    color:
      "#eee",

    background:
      "#090909",

    border:
      "1px solid #343434",

    borderRadius:
      "8px",

    outline:
      "none",

    fontSize:
      "11px",

    fontWeight:
      650,
  };


const emptyStyle:
  React.CSSProperties = {
    padding:
      "40px 20px",

    color:
      "#999",

    textAlign:
      "center",

    fontSize:
      "11px",
  };


const smallButtonStyle:
  React.CSSProperties = {
    height:
      "30px",

    padding:
      "0 10px",

    color:
      "#ccc",

    background:
      "#131313",

    border:
      "1px solid #383838",

    borderRadius:
      "7px",

    fontSize:
      "9px",

    fontWeight:
      850,

    cursor:
      "pointer",
  };



const iconButtonStyle:
  React.CSSProperties = {
    width:
      "28px",

    height:
      "30px",

    padding:
      0,

    color:
      "#c8c8c8",

    background:
      "#111",

    border:
      "1px solid #363636",

    borderRadius:
      "7px",

    fontSize:
      "11px",

    fontWeight:
      900,

    cursor:
      "pointer",
  };


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange:
    (
      value: string
    ) => void;
  placeholder?: string;
  type?: string;
}) {

  return (
    <label
      style={
        fieldWrapStyle
      }
    >

      <span
        style={
          labelStyle
        }
      >
        {label}
      </span>


      <input
        type={
          type
        }
        value={
          value
        }
        placeholder={
          placeholder
        }
        onChange={
          event =>
            onChange(
              event.target.value
            )
        }
        style={
          inputStyle
        }
      />

    </label>
  );
}
