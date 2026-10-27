# 4개 길드 성장력 10분 자동 동기화

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
