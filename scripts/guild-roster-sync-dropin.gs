// 밍보드 4개 길드 직업/성장력 10분 동기화: 기존 스크립트 새 파일에 전체 복사
// 최초 1회 installMingboardTenMinuteRosterTrigger() 실행 및 권한 승인
// 기존 시트/길드/계정은 수정하거나 정렬하지 않습니다.
const MING10_SPREADSHEET_ID = "1M_OwSYyJeXD0PKqToTf1SJ_BMGFmTII2zKYv1JtSThg";
const MING10_SHEET_NAME = "🧾길드현황";
const MING10_GUILDS = ["핑뚝", "아스가르드", "천제", "지옥소녀"];
const MING10_SYNC_URL = "https://mingboard.vercel.app/api/guild-roster-sync";

function ming10ParseGrowth_(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s)) return 0;
  const n = Number(s.replace(/,/g, ""));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
function ming10ReadRoster_() {
  const sheet = SpreadsheetApp.openById(MING10_SPREADSHEET_ID).getSheetByName(MING10_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 4) throw new Error("길드현황 원본 시트를 찾지 못했습니다.");
  // 🧾길드현황 E:M : NO, 닉네임, 직업, 성장력, 길드, 참여율, 참여횟수, 점수, GID
  const rows = sheet.getRange(4, 5, sheet.getLastRow() - 3, 9).getDisplayValues();
  const allowed = new Set(MING10_GUILDS);
  const seen = new Set();
  const counts = Object.fromEntries(MING10_GUILDS.map(name => [name, 0]));
  const members = [];
  rows.forEach((row, index) => {
    const guild = String(row[4] || "").trim();
    if (!allowed.has(guild)) return;
    const gid = String(row[8] || "").trim();
    const nickname = String(row[1] || "").trim();
    if (!/^\d+$/.test(gid) || !nickname || seen.has(gid)) {
      throw new Error((index + 4) + "행 GID/닉네임 누락 또는 중복입니다.");
    }
    seen.add(gid);
    counts[guild]++;
    const growthPower = String(row[3] || "").trim();
    members.push({
      gid, nickname, guild,
      job: String(row[2] || "").trim(),
      growthPower,
      growthPowerNumber: ming10ParseGrowth_(growthPower)
    });
  });
  if (members.length < 150 || MING10_GUILDS.some(name => counts[name] < 10)) {
    throw new Error("원본 데이터가 불완전하여 전송을 중단했습니다: " + JSON.stringify(counts));
  }
  return { members, counts };
}
function syncMingboardFourGuildRoster() {
  const roster = ming10ReadRoster_();
  const props = PropertiesService.getScriptProperties();
  // 기존 DASHBOARD_API_SECRET과 서버 GUILD_WRITE_SECRET의 값이 같으면 재사용 가능.
  const secret = props.getProperty("GUILD_WRITE_SECRET")
    || props.getProperty("DASHBOARD_API_SECRET");
  if (!secret) throw new Error("스크립트 속성에 GUILD_WRITE_SECRET을 설정해주세요.");
  const response = UrlFetchApp.fetch(MING10_SYNC_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ secret, members: roster.members }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  let data;
  try {
    data = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("밍보드 JSON 응답 오류 HTTP " + status);
  }
  if (status < 200 || status >= 300 || !data.success) {
    throw new Error("밍보드 동기화 실패 HTTP " + status + ": " + String(data.message || "오류"));
  }
  Logger.log("밍보드 길드 동기화 성공: " + data.matched + "/" + data.total
    + "명 (수정 " + data.updated + "명)");
  return data;
}
function installMingboardTenMinuteRosterTrigger() {
  // 인증 실패 시 실패하는 트리거를 등록하지 않도록 첫 전송부터 검증.
  const first = syncMingboardFourGuildRoster();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "syncMingboardFourGuildRoster")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncMingboardFourGuildRoster")
    .timeBased().everyMinutes(10).create();
  Logger.log("10분 자동 동기화 트리거 설치 완료");
  return first;
}
