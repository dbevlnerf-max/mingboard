"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";



// ============================================================
// TYPE
// ============================================================

type Period = {
  id: string;

  name: string;

  start_at: string;

  end_at: string;

  status:
    | "open"
    | "closed";

  created_at?:
    | string
    | null;

  closed_at?:
    | string
    | null;
};


type SyncStatus = {
  enabled: boolean;

  allowed: boolean;

  paused: boolean;

  remainingSeconds: number;

  lastSyncAt:
    | string
    | null;
};


// ============================================================
// KST DATE
// ============================================================

function toKstDateInput(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
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


  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Seoul",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      date
    );


  const year =
    parts.find(
      part =>
        part.type ===
        "year"
    )?.value;


  const month =
    parts.find(
      part =>
        part.type ===
        "month"
    )?.value;


  const day =
    parts.find(
      part =>
        part.type ===
        "day"
    )?.value;


  if (
    !year ||
    !month ||
    !day
  ) {
    return "";
  }


  return `${year}-${month}-${day}`;
}


// ============================================================
// 종료일
//
// DB end_at은
// "종료 다음날 00:00" exclusive.
//
// 관리자 입력칸에는
// 실제 종료일을 표시.
// ============================================================

function endAtToInput(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
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


  const adjusted =
    new Date(
      date.getTime() -
      1
    );


  return toKstDateInput(
    adjusted.toISOString()
  );
}


// ============================================================
// KST 날짜시간 표시
// ============================================================

function formatKstDateTime(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "-";
  }


  // Apps Script 반환값
  // yyyy-MM-dd HH:mm:ss
  if (
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return value;
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
    return value;
  }


  return date.toLocaleString(
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


// ============================================================
// 남은시간
// ============================================================

function formatRemainingTime(
  seconds: number
) {
  const safe =
    Math.max(
      0,
      Math.floor(
        seconds
      )
    );


  const minutes =
    Math.floor(
      safe /
      60
    );


  const remainSeconds =
    safe %
    60;


  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}분 ${String(
    remainSeconds
  ).padStart(
    2,
    "0"
  )}초`;
}


// ============================================================
// COMPONENT
// ============================================================

export default function ParticipationManager() {

  // ==========================================================
  // 참여기간
  // ==========================================================

  const [
    periods,
    setPeriods,
  ] =
    useState<
      Period[]
    >(
      []
    );


  const [
    name,
    setName,
  ] =
    useState("");


  const [
    startDate,
    setStartDate,
  ] =
    useState("");


  const [
    endDate,
    setEndDate,
  ] =
    useState("");


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
    message,
    setMessage,
  ] =
    useState("");


  const [
    error,
    setError,
  ] =
    useState("");


  // ==========================================================
  // Google Sheet
  // ==========================================================

  const [
    syncStatus,
    setSyncStatus,
  ] =
    useState<SyncStatus>({
      enabled:
        true,

      allowed:
        true,

      paused:
        false,

      remainingSeconds:
        0,

      lastSyncAt:
        null,
    });


  const [
    syncLoading,
    setSyncLoading,
  ] =
    useState(
      false
    );


  const [
    syncMessage,
    setSyncMessage,
  ] =
    useState("");


  const [
    syncError,
    setSyncError,
  ] =
    useState("");


  const [
    lastSyncedRowCount,
    setLastSyncedRowCount,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  // ==========================================================
  // 현재 진행중 기간
  // ==========================================================

  const openPeriod =
    useMemo(
      () =>
        periods.find(
          period =>
            period.status ===
            "open"
        ) ??
        null,
      [
        periods,
      ]
    );


  // ==========================================================
  // 마감 이력
  // ==========================================================

  const closedPeriods =
    useMemo(
      () =>
        periods.filter(
          period =>
            period.status ===
            "closed"
        ),
      [
        periods,
      ]
    );


  // ==========================================================
  // 현재 기간 → 입력폼
  // ==========================================================

  useEffect(
    () => {
      if (
        openPeriod
      ) {
        setName(
          openPeriod.name
        );


        setStartDate(
          toKstDateInput(
            openPeriod.start_at
          )
        );


        setEndDate(
          endAtToInput(
            openPeriod.end_at
          )
        );


        return;
      }


      setName("");
      setStartDate("");
      setEndDate("");
    },
    [
      openPeriod,
    ]
  );


  // ==========================================================
  // 참여기간 조회
  // ==========================================================

  const loadPeriods =
    useCallback(
      async () => {
        setLoading(
          true
        );


        setError("");


        try {
          const response =
            await fetch(
              "/api/admin/participation",
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
              "참여기간을 불러오지 못했습니다."
            );
          }


          const rows =
            data.periods ??
            data.rows ??
            [];


          setPeriods(
            Array.isArray(
              rows
            )
              ? rows
              : []
          );


        } catch (
          error
        ) {
          setError(
            error instanceof
            Error
              ? error.message
              : "참여기간을 불러오지 못했습니다."
          );


        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );


  // ==========================================================
  // Google Sheet 동기화 상태 조회
  // ==========================================================

  const loadSyncStatus =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/admin/participation/sync-sheet",
              {
                method:
                  "GET",

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
              "동기화 상태를 불러오지 못했습니다."
            );
          }


          setSyncStatus({
            enabled:
              data.enabled !==
              false,

            allowed:
              Boolean(
                data.allowed
              ),

            paused:
              Boolean(
                data.paused
              ),

            remainingSeconds:
              Number(
                data.remainingSeconds ??
                0
              ),

            lastSyncAt:
              data.lastSyncAt ??
              null,
          });


          setSyncError("");


        } catch (
          error
        ) {
          setSyncError(
            error instanceof
            Error
              ? error.message
              : "동기화 상태를 불러오지 못했습니다."
          );
        }
      },
      []
    );


  // ==========================================================
  // 최초 조회
  // ==========================================================

  useEffect(
    () => {
      loadPeriods();
      loadSyncStatus();
    },
    [
      loadPeriods,
      loadSyncStatus,
    ]
  );


  // ==========================================================
  // 남은시간 1초씩 감소
  //
  // API는 매초 호출하지 않고
  // 브라우저 화면 값만 감소
  // ==========================================================

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            setSyncStatus(
              current => {

                // 동기화 중지 상태
                if (
                  !current.enabled ||
                  current.paused
                ) {
                  return current;
                }


                if (
                  current.allowed
                ) {
                  return current;
                }


                if (
                  current.remainingSeconds <=
                  0
                ) {
                  return {
                    ...current,

                    allowed:
                      true,

                    remainingSeconds:
                      0,
                  };
                }


                const next =
                  current.remainingSeconds -
                  1;


                if (
                  next <=
                  0
                ) {
                  return {
                    ...current,

                    allowed:
                      true,

                    remainingSeconds:
                      0,
                  };
                }


                return {
                  ...current,

                  remainingSeconds:
                    next,
                };
              }
            );
          },
          1000
        );


      return () => {
        window.clearInterval(
          timer
        );
      };
    },
    []
  );


  // ==========================================================
  // 참여기간 CREATE
  // ==========================================================

  async function createPeriod() {
    if (
      !name.trim()
    ) {
      setError(
        "집계 이름을 입력해주세요."
      );

      return;
    }


    if (
      !startDate ||
      !endDate
    ) {
      setError(
        "시작일과 종료일을 입력해주세요."
      );

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
          "/api/admin/participation",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                name:
                  name.trim(),

                startDate,

                endDate,
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
          "참여기간 생성에 실패했습니다."
        );
      }


      setMessage(
        data.message ||
        "새 참여기간을 생성했습니다."
      );


      await loadPeriods();


    } catch (
      error
    ) {
      setError(
        error instanceof
        Error
          ? error.message
          : "참여기간 생성에 실패했습니다."
      );


    } finally {
      setSaving(
        false
      );
    }
  }


  // ==========================================================
  // 참여기간 UPDATE
  // ==========================================================

  async function updatePeriod() {
    if (
      !openPeriod
    ) {
      return;
    }


    if (
      !name.trim()
    ) {
      setError(
        "집계 이름을 입력해주세요."
      );

      return;
    }


    if (
      !startDate ||
      !endDate
    ) {
      setError(
        "시작일과 종료일을 입력해주세요."
      );

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
          "/api/admin/participation",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "update",

                id:
                  openPeriod.id,

                periodId:
                  openPeriod.id,

                name:
                  name.trim(),

                startDate,

                endDate,
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
          "참여기간 수정에 실패했습니다."
        );
      }


      setMessage(
        data.message ||
        "참여기간을 수정했습니다."
      );


      await loadPeriods();


    } catch (
      error
    ) {
      setError(
        error instanceof
        Error
          ? error.message
          : "참여기간 수정에 실패했습니다."
      );


    } finally {
      setSaving(
        false
      );
    }
  }


  // ==========================================================
  // 참여기간 CLOSE
  // ==========================================================

  async function closePeriod() {
    if (
      !openPeriod
    ) {
      return;
    }


    const confirmed =
      window.confirm(
        `"${openPeriod.name}" 참여기간을 마감할까요?\n\n마감된 집계는 주간 스냅샷으로 저장됩니다.`
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
          "/api/admin/participation",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "close",

                id:
                  openPeriod.id,

                periodId:
                  openPeriod.id,
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
          "참여기간 마감에 실패했습니다."
        );
      }


      setMessage(
        data.message ||
        "참여기간을 마감했습니다."
      );


      await loadPeriods();


    } catch (
      error
    ) {
      setError(
        error instanceof
        Error
          ? error.message
          : "참여기간 마감에 실패했습니다."
      );


    } finally {
      setSaving(
        false
      );
    }
  }


  // ==========================================================
  // Google Sheet 강제 동기화
  //
  // 관리자 수동 버튼:
  // force:true
  //
  // 단, 동기화 "중지" 상태에서는 막힘
  // ==========================================================

  async function syncSheet() {
    if (
      !syncStatus.enabled ||
      syncStatus.paused
    ) {
      setSyncError(
        "현재 참여현황 시트 동기화가 중지되어 있습니다."
      );

      return;
    }


    setSyncLoading(
      true
    );

    setSyncMessage("");
    setSyncError("");


    try {
      const response =
        await fetch(
          "/api/admin/participation/sync-sheet",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                force:
                  true,
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
          "참여현황 시트 동기화에 실패했습니다."
        );
      }


      const rowCount =
        Number(
          data.rowCount ??
          0
        );


      setLastSyncedRowCount(
        rowCount
      );


      setSyncMessage(
        `✓ 참여현황 동기화 완료 · ${rowCount}명 반영`
      );


      await loadSyncStatus();


    } catch (
      error
    ) {
      setSyncError(
        error instanceof
        Error
          ? error.message
          : "참여현황 시트 동기화에 실패했습니다."
      );


    } finally {
      setSyncLoading(
        false
      );
    }
  }


  // ==========================================================
  // 동기화 중지 / 활성화
  // ==========================================================

  async function toggleSyncEnabled() {
    setSyncLoading(
      true
    );

    setSyncMessage("");
    setSyncError("");


    try {
      const action =
        syncStatus.enabled
          ? "pause"
          : "resume";


      const response =
        await fetch(
          "/api/admin/participation/sync-sheet",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
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
          "동기화 상태 변경에 실패했습니다."
        );
      }


      setSyncMessage(
        data.message ||
        (
          action ===
          "pause"
            ? "참여율 시트 동기화를 중지했습니다."
            : "참여율 시트 동기화를 활성화했습니다."
        )
      );


      await loadSyncStatus();


    } catch (
      error
    ) {
      setSyncError(
        error instanceof
        Error
          ? error.message
          : "동기화 상태 변경에 실패했습니다."
      );


    } finally {
      setSyncLoading(
        false
      );
    }
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      style={{
        width:
          "100%",
      }}
    >



      <div
        style={{
          width:
            "min(1500px, calc(100% - 32px))",

          margin:
            "0 auto",

          padding:
            "28px 0 70px",
        }}
      >

      {/* ==================================================== */}
      {/* TITLE */}
      {/* ==================================================== */}

      <div
        style={{
          marginBottom:
            "26px",
        }}
      >
        <div
          style={{
            color:
              "#8f8f8f",

            fontSize:
              "10px",

            fontWeight:
              800,

            letterSpacing:
              "1.5px",

            marginBottom:
              "7px",
          }}
        >
          PARTICIPATION MANAGEMENT
        </div>


        <h1
          style={{
            margin:
              0,

            color:
              "#ffffff",

            fontSize:
              "28px",

            fontWeight:
              900,

            letterSpacing:
              "-1px",
          }}
        >
          참여 운영 관리
        </h1>


        <p
          style={{
            margin:
              "8px 0 0",

            color:
              "#a9a9a9",

            fontSize:
              "13px",
          }}
        >
          참여 집계기간과 Google Sheet 참여현황 동기화를 관리합니다.
        </p>
      </div>



      {/* ==================================================== */}
      {/* PERIOD CARD */}
      {/* ==================================================== */}

      <section
        style={{
          padding:
            "22px",

          background:
            "#0d0d0d",

          border:
            "1px solid #2b2b2b",

          borderRadius:
            "14px",
        }}
      >

        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              "9px",

            marginBottom:
              "18px",
          }}
        >

          <h2
            style={{
              margin:
                0,

              color:
                "#f4f4f4",

              fontSize:
                "16px",

              fontWeight:
                900,
            }}
          >
            {
              openPeriod
                ? "현재 참여기간"
                : "새 참여기간 생성"
            }
          </h2>


          {
            openPeriod &&
            (
              <span
                style={{
                  padding:
                    "4px 8px",

                  color:
                    "#b9f7c6",

                  background:
                    "rgba(55, 180, 90, 0.10)",

                  border:
                    "1px solid rgba(70, 200, 105, 0.25)",

                  borderRadius:
                    "999px",

                  fontSize:
                    "9px",

                  fontWeight:
                    900,
                }}
              >
                진행중
              </span>
            )
          }

        </div>



        {
          loading
            ? (
              <div
                style={{
                  padding:
                    "28px",

                  color:
                    "#aaa",

                  textAlign:
                    "center",
                }}
              >
                참여기간을 불러오는 중...
              </div>
            )
            : (
              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "minmax(220px, 1fr) 180px 180px auto",

                  gap:
                    "10px",

                  alignItems:
                    "end",
                }}
              >

                {/* 이름 */}

                <label>
                  <span
                    style={{
                      display:
                        "block",

                      marginBottom:
                        "7px",

                      color:
                        "#aaa",

                      fontSize:
                        "10px",

                      fontWeight:
                        800,
                    }}
                  >
                    집계 이름
                  </span>


                  <input
                    type="text"
                    value={
                      name
                    }
                    onChange={
                      event =>
                        setName(
                          event.target.value
                        )
                    }
                    placeholder="예: 9월 2주차 보탐"
                    disabled={
                      saving
                    }
                    style={{
                      width:
                        "100%",

                      height:
                        "42px",

                      boxSizing:
                        "border-box",

                      padding:
                        "0 12px",

                      color:
                        "#f1f1f1",

                      background:
                        "#080808",

                      border:
                        "1px solid #333",

                      borderRadius:
                        "8px",

                      outline:
                        "none",
                    }}
                  />
                </label>



                {/* 시작일 */}

                <label>
                  <span
                    style={{
                      display:
                        "block",

                      marginBottom:
                        "7px",

                      color:
                        "#aaa",

                      fontSize:
                        "10px",

                      fontWeight:
                        800,
                    }}
                  >
                    시작일
                  </span>


                  <input
                    type="date"
                    value={
                      startDate
                    }
                    onChange={
                      event =>
                        setStartDate(
                          event.target.value
                        )
                    }
                    disabled={
                      saving
                    }
                    style={{
                      width:
                        "100%",

                      height:
                        "42px",

                      boxSizing:
                        "border-box",

                      padding:
                        "0 10px",

                      color:
                        "#f1f1f1",

                      colorScheme:
                        "dark",

                      background:
                        "#080808",

                      border:
                        "1px solid #333",

                      borderRadius:
                        "8px",

                      outline:
                        "none",
                    }}
                  />
                </label>



                {/* 종료일 */}

                <label>
                  <span
                    style={{
                      display:
                        "block",

                      marginBottom:
                        "7px",

                      color:
                        "#aaa",

                      fontSize:
                        "10px",

                      fontWeight:
                        800,
                    }}
                  >
                    종료일
                  </span>


                  <input
                    type="date"
                    value={
                      endDate
                    }
                    onChange={
                      event =>
                        setEndDate(
                          event.target.value
                        )
                    }
                    disabled={
                      saving
                    }
                    style={{
                      width:
                        "100%",

                      height:
                        "42px",

                      boxSizing:
                        "border-box",

                      padding:
                        "0 10px",

                      color:
                        "#f1f1f1",

                      colorScheme:
                        "dark",

                      background:
                        "#080808",

                      border:
                        "1px solid #333",

                      borderRadius:
                        "8px",

                      outline:
                        "none",
                    }}
                  />
                </label>



                {/* 버튼 */}

                <div
                  style={{
                    display:
                      "flex",

                    gap:
                      "7px",
                  }}
                >

                  {
                    openPeriod
                      ? (
                        <>
                          <button
                            type="button"
                            onClick={
                              updatePeriod
                            }
                            disabled={
                              saving
                            }
                            style={{
                              height:
                                "42px",

                              padding:
                                "0 15px",

                              color:
                                "#fff",

                              background:
                                "#292929",

                              border:
                                "1px solid #454545",

                              borderRadius:
                                "8px",

                              fontSize:
                                "11px",

                              fontWeight:
                                900,

                              cursor:
                                saving
                                  ? "default"
                                  : "pointer",

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              saving
                                ? "처리중"
                                : "수정저장"
                            }
                          </button>


                          <button
                            type="button"
                            onClick={
                              closePeriod
                            }
                            disabled={
                              saving
                            }
                            style={{
                              height:
                                "42px",

                              padding:
                                "0 15px",

                              color:
                                "#ffb6b6",

                              background:
                                "rgba(180, 45, 45, 0.10)",

                              border:
                                "1px solid rgba(210, 70, 70, 0.28)",

                              borderRadius:
                                "8px",

                              fontSize:
                                "11px",

                              fontWeight:
                                900,

                              cursor:
                                saving
                                  ? "default"
                                  : "pointer",

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            마감
                          </button>
                        </>
                      )
                      : (
                        <button
                          type="button"
                          onClick={
                            createPeriod
                          }
                          disabled={
                            saving
                          }
                          style={{
                            height:
                              "42px",

                            padding:
                              "0 18px",

                            color:
                              "#fff",

                            background:
                              "#292929",

                            border:
                              "1px solid #454545",

                            borderRadius:
                              "8px",

                            fontSize:
                              "11px",

                            fontWeight:
                              900,

                            cursor:
                              saving
                                ? "default"
                                : "pointer",

                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {
                            saving
                              ? "생성중"
                              : "생성"
                          }
                        </button>
                      )
                  }

                </div>

              </div>
            )
        }



        {
          message &&
          (
            <div
              style={{
                marginTop:
                  "14px",

                padding:
                  "11px 13px",

                color:
                  "#bceec8",

                background:
                  "rgba(48, 160, 80, 0.08)",

                border:
                  "1px solid rgba(75, 190, 105, 0.22)",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  700,
              }}
            >
              {message}
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
                  "11px 13px",

                color:
                  "#efaaaa",

                background:
                  "rgba(180, 45, 45, 0.08)",

                border:
                  "1px solid rgba(210, 70, 70, 0.22)",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  700,
              }}
            >
              {error}
            </div>
          )
        }

      </section>



      {/* ==================================================== */}
      {/* GOOGLE SHEET SYNC */}
      {/* ==================================================== */}

      <section
        style={{
          marginTop:
            "16px",

          padding:
            "22px",

          background:
            "#0d0d0d",

          border:
            "1px solid #2b2b2b",

          borderRadius:
            "14px",
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

            gap:
              "20px",
          }}
        >

          <div>

            <div
              style={{
                color:
                  "#8f8f8f",

                fontSize:
                  "9px",

                fontWeight:
                  900,

                letterSpacing:
                  "1.3px",
              }}
            >
              GOOGLE SHEET SYNC
            </div>


            <h2
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#f5f5f5",

                fontSize:
                  "16px",

                fontWeight:
                  900,
              }}
            >
              📄 참여현황 시트 동기화
            </h2>


            <p
              style={{
                margin:
                  "7px 0 0",

                color:
                  "#aaa",

                fontSize:
                  "11px",
              }}
            >
              현재 진행 중인 참여기간의 집계 결과를 📄참여율 관리 시트에 반영합니다.
            </p>

          </div>



          <div
            style={{
              display:
                "flex",

              gap:
                "8px",

              alignItems:
                "center",
            }}
          >

            {/* =============================================== */}
            {/* 동기화 중지 / 활성화 */}
            {/* =============================================== */}

            <button
              type="button"
              onClick={
                toggleSyncEnabled
              }
              disabled={
                syncLoading
              }
              style={{
                height:
                  "42px",

                padding:
                  "0 16px",

                color:
                  syncStatus.enabled
                    ? "#ffb0b0"
                    : "#baf5c9",

                background:
                  syncStatus.enabled
                    ? "rgba(180, 45, 45, 0.10)"
                    : "rgba(45, 170, 80, 0.10)",

                border:
                  syncStatus.enabled
                    ? "1px solid rgba(210, 70, 70, 0.30)"
                    : "1px solid rgba(70, 200, 105, 0.30)",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  900,

                cursor:
                  syncLoading
                    ? "default"
                    : "pointer",

                whiteSpace:
                  "nowrap",
              }}
            >
              {
                syncLoading
                  ? "처리중..."
                  : syncStatus.enabled
                    ? "⏸ 동기화 중지"
                    : "▶ 동기화 활성화"
              }
            </button>



            {/* =============================================== */}
            {/* 수동 동기화 */}
            {/* =============================================== */}

            <button
              type="button"
              onClick={
                syncSheet
              }
              disabled={
                syncLoading ||
                !openPeriod ||
                !syncStatus.enabled ||
                syncStatus.paused
              }
              style={{
                height:
                  "42px",

                padding:
                  "0 17px",

                color:
                  "#fff",

                background:
                  (
                    !openPeriod ||
                    !syncStatus.enabled ||
                    syncStatus.paused
                  )
                    ? "#171717"
                    : "#292929",

                border:
                  "1px solid #454545",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  900,

                cursor:
                  (
                    syncLoading ||
                    !openPeriod ||
                    !syncStatus.enabled ||
                    syncStatus.paused
                  )
                    ? "default"
                    : "pointer",

                opacity:
                  (
                    !openPeriod ||
                    !syncStatus.enabled ||
                    syncStatus.paused
                  )
                    ? 0.45
                    : 1,

                whiteSpace:
                  "nowrap",
              }}
            >
              {
                syncLoading
                  ? "동기화 중..."
                  : "↻ 지금 동기화"
              }
            </button>

          </div>

        </div>



        {/* ================================================== */}
        {/* STATUS CARDS */}
        {/* ================================================== */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",

            gap:
              "9px",

            marginTop:
              "18px",
          }}
        >

          {/* 마지막 동기화 */}

          <div
            style={{
              minHeight:
                "75px",

              display:
                "flex",

              flexDirection:
                "column",

              justifyContent:
                "center",

              padding:
                "0 14px",

              background:
                "#111",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "9px",
            }}
          >
            <span
              style={{
                color:
                  "#999",

                fontSize:
                  "9px",

                fontWeight:
                  800,
              }}
            >
              마지막 동기화
            </span>


            <strong
              style={{
                marginTop:
                  "6px",

                color:
                  "#eee",

                fontSize:
                  "12px",

                fontWeight:
                  900,
              }}
            >
              {
                formatKstDateTime(
                  syncStatus.lastSyncAt
                )
              }
            </strong>
          </div>



          {/* 30분 제한 */}

          <div
            style={{
              minHeight:
                "75px",

              display:
                "flex",

              flexDirection:
                "column",

              justifyContent:
                "center",

              padding:
                "0 14px",

              background:
                "#111",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "9px",
            }}
          >
            <span
              style={{
                color:
                  "#999",

                fontSize:
                  "9px",

                fontWeight:
                  800,
              }}
            >
              자동 동기화 제한
            </span>


            <strong
              style={{
                marginTop:
                  "6px",

                color:
                  !syncStatus.enabled
                    ? "#ffaaaa"
                    : syncStatus.allowed
                      ? "#b9f7c6"
                      : "#eeeeee",

                fontSize:
                  "12px",

                fontWeight:
                  900,
              }}
            >
              {
                !syncStatus.enabled ||
                syncStatus.paused
                  ? "동기화 중지됨"

                  : syncStatus.allowed
                    ? "동기화 가능"

                    : formatRemainingTime(
                        syncStatus.remainingSeconds
                      )
              }
            </strong>
          </div>



          {/* 동기화 상태 */}

          <div
            style={{
              minHeight:
                "75px",

              display:
                "flex",

              flexDirection:
                "column",

              justifyContent:
                "center",

              padding:
                "0 14px",

              background:
                "#111",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "9px",
            }}
          >
            <span
              style={{
                color:
                  "#999",

                fontSize:
                  "9px",

                fontWeight:
                  800,
              }}
            >
              동기화 상태
            </span>


            <strong
              style={{
                marginTop:
                  "6px",

                color:
                  syncStatus.enabled
                    ? "#b9f7c6"
                    : "#ffaaaa",

                fontSize:
                  "12px",

                fontWeight:
                  900,
              }}
            >
              {
                syncStatus.enabled
                  ? "활성화"
                  : "중지"
              }
            </strong>
          </div>



          {/* 최근 반영 인원 */}

          <div
            style={{
              minHeight:
                "75px",

              display:
                "flex",

              flexDirection:
                "column",

              justifyContent:
                "center",

              padding:
                "0 14px",

              background:
                "#111",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "9px",
            }}
          >
            <span
              style={{
                color:
                  "#999",

                fontSize:
                  "9px",

                fontWeight:
                  800,
              }}
            >
              최근 반영 인원
            </span>


            <strong
              style={{
                marginTop:
                  "6px",

                color:
                  "#eeeeee",

                fontSize:
                  "12px",

                fontWeight:
                  900,
              }}
            >
              {
                lastSyncedRowCount ===
                null
                  ? "-"
                  : `${lastSyncedRowCount}명`
              }
            </strong>
          </div>

        </div>



        {/* ================================================== */}
        {/* 안내 */}
        {/* ================================================== */}

        <div
          style={{
            marginTop:
              "13px",

            padding:
              "11px 13px",

            color:
              "#a9a9a9",

            background:
              "#101010",

            border:
              "1px solid #282828",

            borderRadius:
              "8px",

            fontSize:
              "10px",

            lineHeight:
              1.6,
          }}
        >
          {
            syncStatus.enabled
              ? (
                <>
                  일반 자동 동기화는 30분 제한을 따릅니다.
                  관리자 수동 동기화는 쿨타임을 무시하고 즉시 실행할 수 있습니다.
                </>
              )
              : (
                <>
                  현재 참여현황 시트 동기화가 중지되어 있습니다.
                  다시 활성화하면 쿨타임이 초기화되어 즉시 동기화할 수 있습니다.
                </>
              )
          }
        </div>



        {/* ================================================== */}
        {/* 메시지 */}
        {/* ================================================== */}

        {
          syncMessage &&
          (
            <div
              style={{
                marginTop:
                  "13px",

                padding:
                  "11px 13px",

                color:
                  "#bceec8",

                background:
                  "rgba(48, 160, 80, 0.08)",

                border:
                  "1px solid rgba(75, 190, 105, 0.22)",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  700,
              }}
            >
              {syncMessage}
            </div>
          )
        }


        {
          syncError &&
          (
            <div
              style={{
                marginTop:
                  "13px",

                padding:
                  "11px 13px",

                color:
                  "#efaaaa",

                background:
                  "rgba(180, 45, 45, 0.08)",

                border:
                  "1px solid rgba(210, 70, 70, 0.22)",

                borderRadius:
                  "8px",

                fontSize:
                  "11px",

                fontWeight:
                  700,
              }}
            >
              {syncError}
            </div>
          )
        }


        {
          !openPeriod &&
          (
            <div
              style={{
                marginTop:
                  "13px",

                color:
                  "#aaa",

                fontSize:
                  "10px",
              }}
            >
              진행중인 참여기간이 있어야 참여율 시트를 동기화할 수 있습니다.
            </div>
          )
        }

      </section>



      {/* ==================================================== */}
      {/* CLOSED HISTORY */}
      {/* ==================================================== */}

      {
        closedPeriods.length >
          0 &&
        (
          <section
            style={{
              marginTop:
                "16px",

              padding:
                "22px",

              background:
                "#0d0d0d",

              border:
                "1px solid #2b2b2b",

              borderRadius:
                "14px",
            }}
          >

            <h2
              style={{
                margin:
                  0,

                color:
                  "#f4f4f4",

                fontSize:
                  "16px",

                fontWeight:
                  900,
              }}
            >
              마감된 참여기간
            </h2>


            <div
              style={{
                marginTop:
                  "14px",

                border:
                  "1px solid #292929",

                borderRadius:
                  "9px",

                overflow:
                  "hidden",
              }}
            >

              {
                closedPeriods.map(
                  (
                    period,
                    index
                  ) => (
                    <div
                      key={
                        period.id
                      }
                      style={{
                        minHeight:
                          "56px",

                        display:
                          "grid",

                        gridTemplateColumns:
                          "1fr 150px 150px 90px",

                        alignItems:
                          "center",

                        gap:
                          "10px",

                        padding:
                          "0 14px",

                        color:
                          "#ccc",

                        borderBottom:
                          index ===
                          closedPeriods.length -
                          1
                            ? "none"
                            : "1px solid #262626",

                        fontSize:
                          "10px",
                      }}
                    >

                      <strong
                        style={{
                          color:
                            "#eee",

                          fontSize:
                            "11px",
                        }}
                      >
                        {
                          period.name
                        }
                      </strong>


                      <span>
                        시작{" "}
                        {
                          toKstDateInput(
                            period.start_at
                          )
                        }
                      </span>


                      <span>
                        종료{" "}
                        {
                          endAtToInput(
                            period.end_at
                          )
                        }
                      </span>


                      <span
                        style={{
                          color:
                            "#999",

                          fontWeight:
                            800,
                        }}
                      >
                        마감완료
                      </span>

                    </div>
                  )
                )
              }

            </div>

          </section>
        )
      }

      </div>

    </div>
  );
}
