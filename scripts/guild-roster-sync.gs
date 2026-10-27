// Apps Script patch for existing source spreadsheet.
// 1) REPLACE the existing isValidGuild(guild) function with:
function isValidGuild(guild) {
  return ['핑뚝', '아스가르드', '천제', '지옥소녀']
    .includes(String(guild || '').trim());
}

// 2) ADD both functions below at the end of the existing Apps Script file.
// Keep the existing SPREADSHEET_ID, GUILD_SHEET and all other functions.
function syncGuildRosterToPortal() {
  const roster = getGuildStatus();
  if (!roster || !roster.success || !Array.isArray(roster.members) || roster.members.length < 150) {
    throw new Error('4개 길드 원본을 충분히 읽지 못했습니다. 기존 명단을 보호하기 위해 전송하지 않습니다.');
  }
  const secret = PropertiesService.getScriptProperties().getProperty('DASHBOARD_API_SECRET');
  if (!secret) throw new Error('DASHBOARD_API_SECRET 스크립트 속성을 확인해야 합니다.');
  const response = UrlFetchApp.fetch('https://mingboard.vercel.app/api/guild-roster-sync', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ secret: secret, members: roster.members }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let result;
  try { result = JSON.parse(response.getContentText()); } catch (error) {
    throw new Error('밍보드 응답이 올바르지 않습니다. HTTP ' + status);
  }
  if (status < 200 || status >= 300 || !result.success) {
    throw new Error('밍보드 동기화 실패: ' + status + ' / ' + (result.message || '알 수 없음'));
  }
  console.log('길드 동기화: ' + result.matched + '/' + result.total + '명');
  return result;
}

function installGuildRosterSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncGuildRosterToPortal')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncGuildRosterToPortal')
    .timeBased().everyMinutes(10).create();
  return syncGuildRosterToPortal();
}
