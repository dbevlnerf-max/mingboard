# 길드원 저장 오류 수정 — Google Apps Script 운영 배포 필수

## 원인
밍보드 UI 및 `/api/admin/managed-members/[gid]`는 핑뚝/천제/아스가르드/지옥소녀 네 길드를 허용합니다.
그러나 Google Sheets 확장 프로그램 > Apps Script에서 운영 중인 **구버전**은
`isValidGuild()`가 핑뚝/빨뚝/검뚝만 허용하므로, 실제 시트 쓰기가 거부됩니다.
`findMemberRowByGid()`, `getActiveMemberRows()`, `guildNicknameExists()`도 해당 함수를 사용합니다.

## 원본 Apps Script 적용
기존 `isValidGuild(guild)` 함수를 **통째로 교체**합니다.
중복 함수 파일을 추가하지 말고 기존 함수 하나만 변경합니다.

```javascript
function isValidGuild(guild) {
  return ['핑뚝', '천제', '아스가르드', '지옥소녀']
    .includes(String(guild || '').trim());
}
```

기존 `validateGuildMemberInput(body)`에 있는 오류 메시지도 변경합니다:

```javascript
message: '길드는 핑뚝, 천제, 아스가르드, 지옥소녀 중 하나여야 합니다.'
```

**중요:** 프로젝트 저장만으로는 기존 웹앱 `/exec` 배포 버전이 바뀌지 않습니다.
Apps Script 상단 **배포 > 배포 관리 > 현재 웹앱 편집 > 버전: 새 버전 > 배포**를 실행합니다.
기존 웹앱 배포를 업데이트해야 Vercel의 `GOOGLE_SCRIPT_URL`이 유지됩니다.
신규 배포를 만들면 URL이 달라져 환경변수까지 변경해야 하니 추천하지 않습니다.

## 검증
- 원본 `🧾길드현황`의 4개 길드명 중 천제 구성원 GID 301이 존재하는지 확인.
- 밍보드 `/admin/members`에서 GID 301(원참) 직업/전투력 저장.
- Apps Script는 F(닉네임), G(직업), H(성장력), I(길드), M(GID) 열을 사용합니다.
- Google Sheets 저장 성공 후 밍보드 Supabase 스냅샷 수정, 감사로그 생성 순으로 진행합니다.
- 실패 메시지에 '핑뚝·빨뚝·검뚝'이 남아 있다면 Apps Script 배포 버전이 여전히 구버전입니다.

## 안전
- 길드원 GID는 변경하지 않습니다.
- 핑뚝으로 임시 변환해 전송하지 않습니다. 소속 길드가 바뀌는 데이터 오염을 막습니다.
- `/api/admin/managed-members/[gid]`는 Apps Script 저장 성공을 확인하기 전까지 밍보드 스냅샷을 수정하지 않습니다.
- 실제 운영 중인 Apps Script는 GitHub 커밋 또는 Vercel 배포만으로 업데이트되지 않습니다.
