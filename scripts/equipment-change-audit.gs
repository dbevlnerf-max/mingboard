/**
 * 길드원 착용장비 셀의 수동 변경을 "📝장비변경이력"에 남기는 선택형 안전장치.
 *
 * 이 파일은 GitHub 원본입니다. 현재 스프레드시트에 자동 설치되지 않습니다.
 * 같은 스프레드시트에 연결된 Apps Script 프로젝트에 별도 .gs 파일로 붙여넣고
 * installMingEquipmentAuditTrigger()를 한 번 실행해야 실제 기록이 시작됩니다.
 *
 * 주의:
 *  - 원본 길드원 착용장비 시트의 데이터를 수정하지 않습니다.
 *  - 단일 셀 직접 수정만 변경 전 값을 확보할 수 있습니다.
 *  - 범위 붙여넣기/스크립트 변경은 실제 전 값이 없어 확인필요로 처리하거나
 *    이 트리거에 전달되지 않을 수 있으니 승인된 계승 기록으로 취급하지 않습니다.
 *  - 분배내역에 행을 추가했다고 자동으로 실제 장비가 착용되는 것은 아닙니다.
 */
var MING_EQUIP_AUDIT_SPREADSHEET_ID = '1M_OwSYyJeXD0PKqToTf1SJ_BMGFmTII2zKYv1JtSThg';
var MING_EQUIP_SOURCE_TAB = '길드원 착용장비';
var MING_EQUIP_AUDIT_TAB = '📝장비변경이력';
var MING_EQUIP_AUDIT_HANDLER = 'recordMingEquipmentEdit';

function installMingEquipmentAuditTrigger() {
  var ss = SpreadsheetApp.openById(MING_EQUIP_AUDIT_SPREADSHEET_ID);
  if (!ss.getSheetByName(MING_EQUIP_SOURCE_TAB) ||
      !ss.getSheetByName(MING_EQUIP_AUDIT_TAB)) {
    throw new Error('원본 장비 시트 또는 변경이력 시트가 없습니다.');
  }
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === MING_EQUIP_AUDIT_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(MING_EQUIP_AUDIT_HANDLER)
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  console.log('장비 수동 변경 감사 트리거가 설치되었습니다.');
}

function findMingEquipmentMemberAt_(sheet, rowIndex) {
  // Each user has a 12-slot block starting at a row where B=무기 and A has nickname.
  var first = Math.max(5, rowIndex - 15);
  var rows = sheet.getRange(first, 1, rowIndex - first + 1, 26).getDisplayValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    var row = rows[i];
    if (String(row[1] || '').trim() === '무기' && String(row[0] || '').trim()) {
      return {nickname:String(row[0]).trim(), gid:String(row[25] || '').trim()};
    }
  }
  return {nickname:'', gid:''};
}

function recordMingEquipmentEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var source = range.getSheet();
  if (source.getName() !== MING_EQUIP_SOURCE_TAB || range.getRow() < 5) return;
  // Only the '착용 아이템명' column C changes actual wearing/ownership.
  if (range.getColumn() > 3 || range.getLastColumn() < 3) return;
  var audit = source.getParent().getSheetByName(MING_EQUIP_AUDIT_TAB);
  if (!audit) throw new Error('장비변경이력 탭이 없어 기록을 보관할 수 없습니다.');

  var user = '';
  try { user = (e.user && e.user.getEmail && e.user.getEmail()) ||
    Session.getActiveUser().getEmail() || ''; } catch (_) {}
  if (!user) user = '처리자 미확인';

  // A pasted range can change many cells. Apps Script does not expose the
  // per-cell old values. Record an explicit manual-review marker, never a fake old value.
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) {
    audit.appendRow([new Date(),'다중셀수정','', '', '', '',
      '이전 값 확인 불가', '편집 범위 '+range.getA1Notation(), '', '',
      '', user, '확인필요',
      '여러 셀을 함께 수정했습니다. 실제 장비 변경 전후 내용과 GID를 수동 대조하세요.']);
    return;
  }

  var current = String(range.getDisplayValue() || '').trim();
  var oldItem = e.oldValue === undefined
    ? '' : String(e.oldValue || '').trim();
  if (current === oldItem) return;
  var member = findMingEquipmentMemberAt_(source,range.getRow());
  var slot = String(source.getRange(range.getRow(),2).getDisplayValue() || '').trim();
  if (!member.gid || !slot) {
    audit.appendRow([new Date(),'시트직접수정','',member.gid,member.nickname,slot,
      oldItem,current,'','','',user,'확인필요',
      'GID 또는 장비부위 미확인: '+range.getA1Notation()]);
    return;
  }
  audit.appendRow([new Date(),'시트직접수정','',member.gid,member.nickname,slot,
    oldItem,current,'','','',user,'확인필요',
    '셀 '+range.getA1Notation()+' 수동 편집. 최종 지급·계승 확정 및 근거 분배행 별도 확인.']);
}
