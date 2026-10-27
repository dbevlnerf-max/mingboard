/**
 * 밍보드 장비·분배 10분 동기화.
 * 원본 시트를 수정하지 않으며 기존 Apps Script 파일과 독립적으로 설치합니다.
 * Script Properties: GUILD_WRITE_SECRET (서버 환경변수와 동일한 비밀값)
 */
var MING_EQUIPMENT_SHEET_ID = '1M_OwSYyJeXD0PKqToTf1SJ_BMGFmTII2zKYv1JtSThg';
var MING_EQUIPMENT_SYNC_URL = 'https://mingboard.vercel.app/api/equipment-sync';

function syncMingboardEquipmentInventory() {
  var secret = PropertiesService.getScriptProperties().getProperty('GUILD_WRITE_SECRET') ||
    PropertiesService.getScriptProperties().getProperty('DASHBOARD_API_SECRET');
  if (!secret) throw new Error('동기화 비밀값이 Script Properties에 없습니다.');

  var ss = SpreadsheetApp.openById(MING_EQUIPMENT_SHEET_ID);
  var equipment = ss.getSheetByName('길드원 착용장비');
  var distribution = ss.getSheetByName('🪙분배내역');
  if (!equipment || !distribution) throw new Error('장비/분배 시트를 찾지 못했습니다.');

  var last = equipment.getLastRow();
  var grid = equipment.getRange(1, 1, Math.max(last, 4), 26).getDisplayValues();
  var members = [];
  var ids = {};
  var expectedSlots = [
    '무기','보조무기','투구','상의','장갑','망토',
    '신발','하의','귀걸이','허리띠','목걸이','반지'
  ];
  for (var i = 4; i < grid.length; i++) {
    var first = grid[i];
    if (String(first[1]).trim() !== '무기' || !String(first[0]).trim()) continue;
    var gid = String(first[25]).trim();
    if (!/^\d+$/.test(gid) || ids[gid]) throw new Error('GID 누락/중복: ' + (i + 1) + '행');
    var slots = [];
    for (var k = 0; k < 12; k++) {
      var slotRow = grid[i + k] || [];
      var slot = String(slotRow[1] || '').trim();
      if (slot !== expectedSlots[k]) throw new Error((i + k + 1) + '행 장비 부위를 확인하세요.');
      var item = String(slotRow[2] || '').trim();
      slots.push({slot: slot, item: item, enhancement: String(slotRow[3] || '').trim(),
        personal: item.indexOf('개인구매') >= 0});
    }
    members.push({gid: gid, sourceNickname: String(first[0]).trim(), slots: slots});
    ids[gid] = true;
    i += 13;
  }
  if (members.length < 50 || members.length > 250) throw new Error('장비 인원 수가 비정상입니다: ' + members.length);

  var end = distribution.getLastRow();
  var rows = end >= 6 ? distribution.getRange(6, 2, end - 5, 8).getDisplayValues() : [];
  var categories = {'무기': true, '보조무기': true, '방어구': true, '장신구': true};
  var history = [];
  for (var r = 0; r < rows.length; r++) {
    var cells = rows[r];
    var date = String(cells[0] || '').trim();
    var item = String(cells[1] || '').trim();
    var category = String(cells[2] || '').trim();
    if (!date || !item || !categories[category]) continue;
    history.push({
      row: r + 6, date: date, item: item, category: category,
      job: String(cells[3] || '').trim(), target: String(cells[4] || '').trim(),
      diamond: String(cells[5] || '').trim(), notes: String(cells[7] || '').trim()
    });
  }
  if (history.length > 3000) throw new Error('분배 이력 최대 건수를 초과했습니다.');

  var response = UrlFetchApp.fetch(MING_EQUIPMENT_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({secret: secret, members: members, history: history}),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  var result;
  try { result = JSON.parse(response.getContentText()); } catch (_) { result = null; }
  if (code < 200 || code >= 300 || !result || !result.success) {
    throw new Error('장비 동기화 실패 (' + code + '): ' + (result && result.message || '응답 확인 필요'));
  }
  console.log('밍보드 장비 동기화 완료: 인원=' + result.registered + ' 이력=' + result.history);
  return result;
}

function installMingboardEquipmentTenMinuteTrigger() {
  // 첫 동기화 성공을 확인한 후에만 자동 실행을 설치합니다.
  var result = syncMingboardEquipmentInventory();
  var handler = 'syncMingboardEquipmentInventory';
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(10).create();
  console.log('밍보드 장비 자동 동기화 트리거: 10분');
  return result;
}
