# 4개 길드 성장력 10분 자동 동기화

## 간편 설치: 기존 코드 수정 없이 새 파일 하나로 10분 동기화

1. 원본 시트: https://docs.google.com/spreadsheets/d/1M_OwSYyJeXD0PKqToTf1SJ_BMGFmTII2zKYv1JtSThg/edit → 확장 프로그램 → Apps Script
2. 좌측 + → 스크립트, 새 파일 이름: MingboardRoster10min
3. scripts/guild-roster-sync-dropin.gs 의 전체 내용을 새 파일에 붙여넣고 저장. 기존 함수를 삭제하거나 다른 코드를 덮어쓰지 말 것
4. 프로젝트 설정 → 스크립트 속성의 GUILD_WRITE_SECRET 값이 Vercel 동명 환경변수와 동일한지 확인. 기존 DASHBOARD_API_SECRET 값과 같으면 그대로 사용 가능. 비밀값은 공유하지 말 것
5. 함수 선택 목록에서 installMingboardTenMinuteRosterTrigger 선택 → 실행 → Google 권한 승인
6. 실행 로그에 186/186명 동기화 성공 및 트리거 설치 완료 메시지를 확인하고, 왼쪽 트리거에서 10분 시간 기반 실행 확인

새 파일은 원본 🧾길드현황 E:M을 읽기 전용으로만 조회하여 승인된 GID의 직업·성장력만 밍보드에 보냅니다. 닉네임·길드·GID·디스코드 권한·분배·출석률은 변경하지 않습니다. 트리거는 저장한 스크립트의 최신 코드를 사용하므로 이 설정 자체에는 웹앱 재배포가 필요하지 않습니다. 기존 길드 조회의 자동 정렬·필터 문제를 해결하려면 아래의 별도 지침을 적용하세요.


## 확인된 원본
- Google Sheets: 아프로디테02 핑뚝 / `🧾길드현황` E:M
- 원본 186명: 핑뚝 55, 아스가르드 53, 천제 24, 지옥소녀 54
- 원본 GID 186개는 2026-10-27 Supabase 고정 명단 GID와 정확히 일치
- Apps Script 기존 `isValidGuild`에 핑뚝·빨뚝·검뚝만 적혀 있어 원본 131명이 누락됐음

## Apps Script 최초 설치 (운영자 1회)
1. **원본 구글시트** → 확장 프로그램 → Apps Script에서 **운영 중인 스크립트**를 열기
2. 기존 `isValidGuild(guild)`의 허용 길드를 `핑뚝`, `아스가르드`, `천제`, `지옥소녀`로 변경
3. 기존 `getGuildStatus()` 안의 `sortActiveGuildMembers_(sheet, headerInfo)` 자동 정렬 구간 제거 (조회 중 시트 행 재배치 방지)\n4. [scripts/guild-roster-sync.gs](scripts/guild-roster-sync.gs)에 포함된 `syncGuildRosterToPortal`, `installGuildRosterSyncTrigger` 읽기 전용 `readFourGuildRosterForSync_`와 동기화/트리거 설치 함수 등 세 개를 추가 (다른 기존 코드는 보존)
5. 기존 Script Properties의 `DASHBOARD_API_SECRET`이 멤버 상태 동기화 때와 동일하게 구성돼 있는지 확인. 키를 채팅이나 GitHub에 붙여넣지 말 것
6. Apps Script에서 **`installGuildRosterSyncTrigger`를 딱 한 번 실행**, 권한 승인
7. **배포 → 배포 관리 → 기존 웹앱 편집 → 새 버전 배포** (기존 웹앱 URL 유지)
8. 첫 자동 전송 결과 `matched=186`, `total=186` 확인

전용 읽기 함수는 **원본 시트를 정렬하거나 변경하지 않습니다.** 기존 `getGuildStatus`는 읽기 중 자동 정렬을 수행할 수 있어, 10분 트리거에서는 호출하지 않습니다.\n기존 명단의 GID·길드·닉네임·계정 인증·분배 내역은 동기화 대상이 아닙니다.
성장력·직업의 유효한 값만 적용하고, 원본에서 충분한 인원을 읽지 못하면 저장을 거부합니다.
Apps Script 트리거는 10분마다 실행되며, Vercel Hobby 요금제 제한과 무관합니다.
