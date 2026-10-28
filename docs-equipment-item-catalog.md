# 밍보드 자체 장비 DB

## 장비 데이터의 두 층
- `portal_sheet_snapshots (manual-equipment-inventory)`: 길드원 GID별 **현재 착용 기록** 12부위. 원본은 Google Sheet, 사진은 별도.
- `public.equipment_item_catalog`: 고유 장비 정의(이름·부위·등급·T단계·종류·직업·별칭·아이콘). 길드원 소유 여부와 무관.

## 보안
DB는 RLS ON, `anon` / `authenticated` 직접 SELECT 불가. 서버 전용 secret 역할만 DB에 접근.
밍보드 `/api/equipment`은 ADMIN/MASTER 세션만 카탈로그를 함께 반환.

## 아이콘 표시 조건
1. 시트 아이템의 정확한 이름·T단계·등급·부위가 카탈로그와 일치
2. 직업 전용 장비면 직업도 일치
3. `icon_verified = true`이며 `icon_asset`가 `/equipment/icons/` 경로를 가리킴
4. **영웅** 아이템은 T1부터 가능, **희귀**는 T4부터만 실제 아이콘 표시
5. 확인된 DB 매칭이 없으면 다른 아이템의 이미지를 재활용하지 않음

영웅 아이템명은 보라색, 희귀 T4 이상은 파란색. 이미지가 없더라도 등급색만 적용될 수 있음.

## 초기 검증 완료 아이콘
`public/equipment/icons/assassin-sprite.webp` (원본 단검 이미지 7장):
- 인덱스 1: 영웅 T2 영웅의 단검
- 인덱스 2: 희귀 T4 승리의 단검
- 인덱스 4: 희귀 T5 찬란한 단검
- 인덱스 5: 희귀 T6 위대한 단검

이름 미확정으로 보류: 인덱스 0(T1_H2), 3(T5 보조무기), 6(T1_H).
이들은 검증 전 다른 아이템과 매칭하지 않음.

## 2026-10-28 고화질 방어구 이미지 교체
- 소스: 사용자 제공 `아이템_아이콘_고화질 (2).zip` 내 방어구 PNG 48장.
- 범위: 투구·상의·장갑·하의·신발·망토, 영웅 T1/T2 18종 + 희귀 T4/T5/T6 30종.
- 전용 에셋: `public/equipment/icons/armor-hero-20261028.webp` (18프레임), `armor-rare-20261028.webp` (30프레임).
- 변경 SQL: `supabase/seeds/equipment_armor_icons_20261028.sql` (기존 카탈로그 방어구 아이콘 덮어쓰기, 누락된 장갑 8종 카탈로그 추가).
- 무기 및 장신구 아이콘, 시트/GID/착용·분배 데이터는 변경하지 않는다.

## 신규 이미지 대량 추가 절차
1. **원본 개별 이미지 파일명**과 정확한 게임 장비명을 함께 확인한다. 권장 파일명: `assassin_weapon_t6_great_dagger.webp`.
2. `public/equipment/icons/` 에 등록한다. 단일 이미지는 `sprite_index = NULL`, 묶음 이미지는 프레임 번호를 지정한다.
3. `equipment_item_catalog`에 고유 ID, 이름, `slot`, `rarity`, `tier`, 종류 및 직업, `icon_asset`를 넣는다.
4. 실제 장비명과 이미지가 일치할 때만 `icon_verified=true`로 전환한다.
5. 브라우저 캐시나 동기화 자료 변경이 없어도 카탈로그는 API에서 서버 조회되므로 페이지 새로고침으로 확인한다.

기존 시트, GID, 분배 이력은 이 카탈로그 작업에서 절대 변경하지 않는다.
