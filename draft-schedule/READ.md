# PGMDR 편성 작업판 — 개발 로그

## 프로젝트 목적

한국 TV 방송 초안 편성 협업 도구.  
MD 팀원 여러 명이 **실시간으로 같은 화면**을 보며 주간 편성표를 구성한다.  
GAS(Google Apps Script)에서 슬롯·제안상품·실적을 불러와 Firebase에 캐시하고,  
Zustand 스토어로 상태를 관리하며 @dnd-kit 드래그로 편성 블록을 배치한다.

## 기술 스택

- React 19 + Vite (SPA)
- Zustand (전역 상태)
- Firebase Realtime Database (asia-southeast1, 실시간 협업)
- Google Apps Script API (원본 데이터 fetch)
- @dnd-kit (드래그앤드롭)

## 세션 키 구조

```
{startDate}_{poolType}  →  예) 2026-05-19_A
Firebase 세션 데이터: sessions/{weekKey}/...
Firebase 세션 레지스트리: activeSessions/{weekKey}  (세션 목록 화면용 경량 인덱스)
```

> `activeSession` (단수) 강제 전환 노드는 2026-05-23에 제거됨.  
> 세션 전환은 개인 localStorage(lastWeekKey) 기반으로만 동작 → 다른 팀원 화면에 영향 없음.

## 실행 명령

```bash
npm run dev      # 개발 서버 (HMR)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
node scripts/cleanup-sessions.mjs  # Firebase 세션 전체 삭제
```

---

## 수정 이력

| 날짜       | 작업자        | 카테고리 | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-22 | SeungHyun-111 | fix      | split 슬롯 CA/IP 가중분 이중계산 — `makeDefaultBlock`이 CA·IP 채널에도 전체 `weightedMin`을 쓰는 버그. `splitWeightedMin` import 후 channel별 비례 분할값 적용. CA+IP 합 = 원래 슬롯 가중분 보장 (`blockBuilders.js`)                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-22 | SeungHyun-111 | fix      | 편성비중 도넛차트 순서·편성팀 누락 — `isDefault` 필터 제거로 "편성팀" 포함, `sortedData` 단일 배열로 내·외 링 12시 기점 순서 통일 (`useRatioStats.js`, `RatioDonutChart.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-22 | SeungHyun-111 | fix      | 편성비중 목표값 미인식 — GAS `teamName`("영업1팀")과 block `mdTeam`("영업1") 간 "팀" 접미사 불일치로 `targetMap` 조회 실패. `targetMap` 생성 시 원본·변형 양방향 등록으로 해결 (`ScheduleRatio.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-22 | SeungHyun-111 | feat     | 편성 그리드 flexible 높이 — 슬롯이 화면보다 적으면 자동으로 꽉 채움, 많으면 MIN_ROW_HEIGHT(28px) 기준 스크롤. `ScheduleGrid.jsx`에 bodyRef ResizeObserver 추가, unitHeight 동적 계산                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-22 | SeungHyun-111 | feat     | Firebase `activeSession` 추가 — 협업 시 자동 세션 동기화. 누군가 새 편성을 시작하면 모든 접속자가 같은 세션에 자동 합류. localStorage 의존 제거, Firebase를 공유 진입점으로 사용                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-22 | SeungHyun-111 | fix      | split 슬롯 드래그·드롭 및 사이드바 블록 복구                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-22 | SeungHyun-111 | fix      | index.html 및 스타일 오류 수정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-22 | SeungHyun-111 | feat     | 실적예상값 페이지 전면 개편 — 요약카드(총취급고·한익·분당취급고·한익·미입력수), 일자별/팀별·카테고리별 Bar 차트(recharts), 그룹별 분당취급고·분당한익 요약표, 직전실적 미입력 블록 별도 알림 섹션, 전체 상세 테이블 인라인 수정(셀 클릭→입력→saveManualInput) 포함 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                        |
| 2026-05-22 | SeungHyun-111 | fix      | 선편성 블록 경쟁 생성 버그 2종 — ①`handleBlockDrop`이 컴포넌트 클로저의 stale `scheduleBlocks`를 참조해 선편성 블록을 못 찾는 문제: `getState().scheduleBlocks`로 교체(`DraftSchedule.jsx`). ②`SlotRow` 블록-블록 드래그가 경쟁 로직 없이 덮어쓰는 문제: 타깃 슬롯에 비디폴트 블록이 있으면 경쟁 블록 생성으로 분기 추가(`SlotRow.jsx`). isPreSchedule: false 명시로 리프레시 시 보호 목록 포함                                                                                                                                                                                                       |
| 2026-05-22 | SeungHyun-111 | fix      | 선편성 블록 경쟁 생성 후 isPreSchedule 잔류 — saveBlock이 Firebase update(병합)를 사용하므로 선편성 블록에서 경쟁 생성 시 isPreSchedule: true가 남아, refreshActions의 protectedBlocks 필터(!b.isPreSchedule)에서 제외돼 다음 리프레시 시 경쟁 블록이 선편성으로 덮어써지는 버그. 경쟁 생성 패치에 isPreSchedule: false 명시 추가(`DraftSchedule.jsx`)                                                                                                                                                                                                                                                |
| 2026-05-22 | SeungHyun-111 | fix      | 편성비중 totalTarget → totalSlotWeighted 기준 통일 — GAS weeklyTarget 합계 대신 주간 슬롯 가중분 합계를 전체 목표 기준으로 사용 (`ScheduleRatio.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-22 | SeungHyun-111 | fix      | ghost default 블록 Firebase 자동 정리 — splitSlots에 있는 슬롯의 isDefault 블록을 \_loadFromFirebase 진입 시 자동 삭제 (`sessionActions.js`)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-22 | SeungHyun-111 | docs     | 설명서 로컬 캐시 vs Firebase DB 섹션 추가 — localStorage(lastWeekKey·theme·userName)는 브라우저 단위·팀 미공유, Firebase(activeSession·sessions/{weekKey})는 팀 전체 실시간 공유임을 명시. 잘못된 Firebase 직접 수정 주의 안내 포함 (`HelpPage.jsx`)                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-23 | SeungHyun-111 | feat     | 탭명 '실적 예상값' → '시뮬레이션' 변경 (`App.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-23 | SeungHyun-111 | feat     | [편성팀] 디폴트 블록 완전 카드화 — `isDefault: false` + `memoCode: '[전사블록]'` 설정. 드래그·사이드바 반환·경쟁 생성 등 일반 블록과 동일하게 동작. 모든 컴포넌트에서 `isDefault` 조건 제거, `isPgmTeam`(pgmCodeName==='[편성팀]') 기준으로 스타일만 별도 적용. ghost 블록 정리 조건도 `isDefault→pgmCodeName==='[편성팀]'`로 변경 (`blockBuilders.js`, `sessionActions.js`, `ScheduleBlock.jsx`, `SlotRow.jsx`, `Sidebar.jsx`, `blockActions.js`)                                                                                                                                                    |
| 2026-05-23 | SeungHyun-111 | feat     | 시뮬레이션 페이지 Hero 카드 전면 개편 — ①분당취급고·②분당한익 달성률 progress bar를 전사 목표(companyTotal.salesPerMin/profitPerMin) 기준으로 변경. ③전사블록 시뮬레이션 카드: 편성팀 슬롯 수·가중분·비중 표시 + 분당취급고/한익 실시간 입력(debounce 500ms→saveManualInput). placeholder = 전사 목표값. 탭 전환 후 입력값 자동 복원(useEffect + pgmTeamRows[0].perfKey 기반 manualInputs 조회) (`PerformanceForecast.jsx`)                                                                                                                                                                           |
| 2026-05-23 | SeungHyun-111 | feat     | 일자별 차트 개선 — 전사 목표 빨간 기준선(ReferenceLine) 추가. 막대 상단 데이터 레이블(만원 단위, 소수점 1자리). Y축 도메인 동적 계산(max(dataMax, 전사목표) × 1.12)으로 목표선 잘림 방지 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-23 | SeungHyun-111 | feat     | 총 예상취급고/한익 목표 역산 표시 — 전사 분당목표 × 전체 슬롯 가중분으로 주간 목표 역산, 달성률 % 보조 요약카드에 표시 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-23 | SeungHyun-111 | feat     | 팀별 볼륨 바 분리 — 취급고·한계이익 카드 각각 분리(위아래 배치), groupBy 토글 헤더에서 공유. 전사블록 제외 스위치 페이지 상단 추가(excludePgmTeam) (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-23 | SeungHyun-111 | feat     | 팀별 관점 차트 개선 — XAxis 캡 전사목표×1.5 + `allowDataOverflow`로 실제 클리핑 적용. 목표 없는 팀(편성팀·미분류 등)은 전사 목표로 fallback(effectiveTargetSalesPerMin/ProfitPerMin). 캡 초과 바에 인사이드 레이블(#.#만). 팀명 폰트 15px/YAxis 너비 75px. 바 높이 1.5배·barCategoryGap 16% (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                               |
| 2026-05-23 | SeungHyun-111 | feat     | 일자별 차트 팀별 툴팁 — 호버 시 팀별 취급효율/한익효율 + 비중 분해 표시. dailyTeamData useMemo(date×team 교차 집계) + DailyTeamTip 컴포넌트 추가 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-23 | SeungHyun-111 | feat     | 일자별 클릭 필터 — 막대 클릭 시 해당 일자만 필터(selectedDate). displayRows = rows.filter(dateKey). Hero·요약·볼륨바·팀별관점·효율테이블·상세테이블 전체 연동. 선택된 바 노란 하이라이트·미선택 dim. 동일 일자 재클릭 또는 "전체 보기" 버튼으로 해제 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                      |
| 2026-05-23 | SeungHyun-111 | fix      | 시뮬레이션 페이지 하단 2섹션 미렌더링 — ①`DailyTeamTip` 내 `.map()` Fragment에 key 누락(`<>` → `<Fragment key={t.name}>`)으로 React 19 렌더 크래시. ②외부 div에 `display:flex + height:100% + overflowY:auto` 동시 적용으로 스크롤 불가. 외부(스크롤 컨테이너)·내부(flex 레이아웃) div 분리로 해결 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                        |
| 2026-05-23 | SeungHyun-111 | feat     | 시뮬레이션 테이블 정렬·리사이즈 — 직전실적미확인·편성별 실적 상세 두 테이블에 컬럼 헤더 클릭 정렬(▲▼⇅), 컬럼 우측 드래그 핸들 너비 조절 추가. 첫 드래그 시 모든 컬럼 offsetWidth 스냅샷 → `table-layout:fixed` 전환. 기본 상태는 `table-layout:auto + width:100%`로 페이지 폭 자동 채움. `overflow:hidden + textOverflow:ellipsis`로 줄바꿈 없이 우측 클리핑 (`PerformanceForecast.jsx`)                                                                                                                                                                                                              |
| 2026-05-23 | SeungHyun-111 | remove   | 팀별 분당 효율 요약 테이블 삭제 — 요청 없이 포함된 섹션. `groupCols`, `makeThStyle` 함께 제거 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-23 | SeungHyun-111 | fix      | 직전실적미확인 섹션 항상 펼침 — 아코디언 토글(showMissing state) 제거, 항상 열린 상태 (`PerformanceForecast.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-23 | SeungHyun-111 | feat     | 시간 분할·삭제 기능 — Firebase `sessions/{weekKey}/customSlots` 경로 신설. GAS 원본 pgmSlots 보존하며 오버라이드 레이어로 관리. 시간 라벨 우클릭 → 분할/삭제 모달. `getEffectivePgmSlots` 유틸리티로 pgmSlots+customSlots 병합·시간순 정렬. customSlots Firebase 실시간 구독 추가 (`timeSlotActions.js`, `effectiveSlots.js`, `ScheduleGrid.jsx`, `sessionActions.js`, `firebaseSubscribe.js`)                                                                                                                                                                                                        |
| 2026-05-23 | SeungHyun-111 | feat     | 편성비중 PGM건수 카드 3종 신설 — `RatioPgmCount.jsx` 신규. 채널별/거래형태별/영상구분별 피벗 테이블 카드를 세로 3장 배치 (`ScheduleRatio.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-23 | SeungHyun-111 | feat     | 초안 편성표 검색 기능 — `SearchPanel.jsx` 신규(우측 패널). 편성 리스트(거래형태별·채널별 건수/가중분/비중/분당효율 표) + 미편성 리스트. ScheduleGrid 툴바 우상단 검색창 연동. `gridSearch` Zustand 상태 추가                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-23 | SeungHyun-111 | feat     | 사이드바 필터 개선 — 영상구분(videoStatus) 셀렉트 추가. 가나다↑/↓ 정렬 토글. 사이드바 카드 우클릭 복사/삭제 컨텍스트 메뉴. `+ 추가` 버튼으로 상품 직접 추가 (`Sidebar.jsx`, `ProductCard.jsx`, `ProductFilters.jsx`)                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-23 | SeungHyun-111 | feat     | 멀티 세션 관리 — `activeSessions` Firebase 루트 경로 신설(세션 레지스트리). `SessionPickerScreen`(세션 선택 초기화면), `SessionSwitcher`(상단 세션 전환 드롭다운), `SessionDeleteModal`(플레이스홀더 확인 입력 후 삭제) 추가. 새 세션 생성 시 `sessions/` + `activeSessions/` 동시 등록, 삭제 시 동시 제거                                                                                                                                                                                                                                                                                            |
| 2026-05-23 | SeungHyun-111 | fix      | lastWeekKey Firebase 검증 — 앱 진입 시 `sessions/{key}/gasData/meta` 존재 여부 먼저 확인. 삭제된 세션이면 lastWeekKey 자동 제거 후 SessionPickerScreen 표시 (`DraftSchedule.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-23 | SeungHyun-111 | remove   | `activeSession` 강제 전환 로직 제거 — 누군가 새 편성 시작 시 모든 팀원 화면이 강제 전환되는 문제. `onValue(activeSession)` 구독 및 resetSession 내 activeSession write 제거. 세션 전환은 개인이 명시적으로 선택하는 방식으로 변경 (`DraftSchedule.jsx`, `sessionActions.js`)                                                                                                                                                                                                                                                                                                                          |
| 2026-05-23 | SeungHyun-111 | docs     | 설명서 전면 개편 — 풀 페이지 레이아웃. 데이터 흐름·갱신 메뉴별 처리 범위·로컬 vs Firebase 저장 위치·협업 동기화 범위·Firebase 경로 구조(루트/세션 분리)·계산 로직·편성표 사용법·세션 관리·GAS 컬럼 사전 포함 (`HelpPage.jsx`)                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-23 | SeungHyun-111 | chore    | scripts/cleanup-sessions.mjs 추가 — Firebase sessions/activeSessions/activeSession 전체 삭제 Node.js 스크립트                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-23 | SeungHyun-111 | refactor | Firebase 키 인코딩 유틸 통합 — `src/utils/firebaseKey.js` 신설(`encodeKey`, `decodeKey`, `decodeMapKeys`). sessionActions·firebaseSubscribe·blockBuilders·itemActions 4곳에 흩어진 `__LB__/__RB__` replace 로직 단일 모듈로 통합                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-23 | SeungHyun-111 | refactor | Firebase 구독 해제 패턴 교체 — `off(ref)` 대신 `onValue()` 반환 unsubscribe 함수 저장·호출 패턴으로 전환. `firebaseSubscribe.js`, `usePresence.js`, `useChat.js` 적용. off import 전체 제거                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-05-23 | SeungHyun-111 | refactor | Firebase 다중 write → 원자적 단일 update 전환 — `changeBlockChannel`(blockActions), `splitSlotTime`·`deleteSlotTime`(timeSlotActions) 에서 순차 set() 최대 9회를 `update(weekKey, { path: val, ... })` 1회로 교체. 동시 사용자 race condition 위험 제거                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-23 | SeungHyun-111 | refactor | React.memo 적용 — `ScheduleBlock.jsx`, `SlotRow.jsx`. teamFilter·gridSearch 변경 시 해당 블록만 재렌더, Firebase onValue 발생 시 변경된 슬롯만 갱신                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-23 | SeungHyun-111 | refactor | React.lazy 탭 코드 분할 — `App.jsx`에서 시뮬레이션·편성비중·편성현황·설명서 4개 탭 lazy import + Suspense 래퍼. 초기 번들에서 분리, 첫 탭 전환 시 로드                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-24 | SeungHyun-111 | feat     | Excel 내보내기 컬럼 전면 개편 — 기존 범용 컬럼 제거, 샘플 양식 기준 13컬럼으로 재구성(DATE/TIME/단순분/가중분/팀명/다원방송/MD분류/상품명/재신상품/혼합직매입/대기업수입여부/메모코드/편성C). 팀명·MD분류·대기업수입여부 공란. 채널 정규화(ALL→공란, CA→CH1(CA), IP→CH2(IP)). 거래형태 정규화([위]·[률]→공란, [직]→직매입, [혼]→혼합, [모]→(광), [액]→정액). 재/신상품 기존→공란 (`exportUtils.js`)                                                                                                                                                                                                   |
| 2026-05-24 | SeungHyun-111 | refactor | 내보내기 모달 필터 전면 제거 — 기본블록포함/메모포함/실적정보포함/그룹기준 옵션 삭제. 모달은 건수·기간 표시 + 취소/인쇄/HTML/Excel 버튼만 유지 (`ExportModal.jsx`)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-24 | SeungHyun-111 | feat     | HTML 내보내기 전 섹션 앱 화면 동기화 — 편성표·시뮬레이션·편성비중·편성현황 4개 섹션 전면 재작성. 편성표: 조직 필터 select(JS) + data-team 속성으로 클라이언트사이드 dim 필터 추가. 시뮬레이션: HeroCard(달성률 바)/StatCard(5개)/팀별볼륨바/일자별테이블/팀별관점테이블/미입력실적/상세15컬럼. 편성비중: RatioSummaryCards(5개)/RatioTable(팀별+카테고리별, 달성률바)/RatioPgmCount(채널별·거래형태별·영상구분별 피벗3개). 편성현황: 등급분포요약표/StatusScheduled(11컬럼)/StatusUnscheduled(8컬럼). targetMetrics HtmlSectionSelectModal 전달 추가 (`exportUtils.js`, `HtmlSectionSelectModal.jsx`) |

---

## 주요 이슈 / 결정 기록

### 2026-05-22 — activeSession 협업 동기화 (이후 제거됨)

**문제**: `lastWeekKey`를 `localStorage`에 저장 → 브라우저 단위 저장이라 다른 팀원 기기에는 없음.

**초기 해결 (2026-05-22)**: Firebase 루트에 `activeSession` 노드 추가. `onValue` 리스너로 세션 변경 시 전체 화면 자동 전환.

**재문제 (2026-05-23)**: 팀원 A가 "새 편성 시작"을 누르면 작업 중인 팀원 B 화면도 강제 전환됨 → 기존 작업 맥락 단절.

**최종 해결**: `activeSession` 강제 전환 완전 제거. 대신 `activeSessions`(복수) 레지스트리 + `SessionPickerScreen`으로 세션 선택권을 개인에게 부여.

---

### 2026-05-23 — 멀티 세션 관리 설계

**구조**:

- `activeSessions/{weekKey}` — 경량 레지스트리 (5개 필드). 세션 목록 표시에 사용.
- `sessions/{weekKey}/` — 실제 편성 데이터 전체. 로드/삭제 시만 접근.

**삭제 인증**: 플레이스홀더 문구(5종 랜덤) 직접 입력해야 삭제 버튼 활성화 → 실수 방지.

**세션 전환**: `handleSwitch()` → localStorage `lastWeekKey` 업데이트 → `loadInitData()`. 자신만 전환, 다른 팀원 화면 영향 없음.

---

### 2026-05-23 — [편성팀] 블록 isDefault 제거 경위

**문제**: `isDefault: true` 인 블록은 드래그·사이드바 반환·팀 필터 dim 등 모든 상호작용에서 제외돼 있었음.  
편성팀 슬롯을 시뮬레이션에 포함하고 실제 블록처럼 움직이게 하려면 일반 블록과 동일하게 취급해야 했음.

**해결**: `isDefault: false` 로 변경, 식별은 `pgmCodeName === '[편성팀]'`(isPgmTeam)로만 수행.  
스타일만 `var(--bg3)/var(--text3)` 회색 계열 유지, 나머지 동작은 일반 블록과 동일.

**perfKey 주의**: `makePerfKey('', '[편성팀]')` = `normalizeDealType('') + '[편성팀]'` = `'[위][편성팀]'`.  
manualInputs 조회 시 `'[편성팀]'`이 아닌 `pgmTeamRows[0]?.perfKey` 로 참조해야 함.

---

### 2026-05-23 — customSlots 설계 원칙

**왜 GAS pgmSlots를 직접 수정하지 않나**: pgmSlots는 GAS 원본이며 세션 리셋 시 재로드 기준. 직접 수정하면 리셋 후 복구 불가.

**customSlots 구조**:

```
sessions/{weekKey}/customSlots/{id}: {
  // 원본 슬롯 override (durationMin/weightedMin 변경):
  durationMin: number, weightedMin: number

  // 원본 슬롯 삭제:
  deleted: true

  // 분할로 생성된 신규 슬롯:
  slotId, dateKey, timeText, durationMin, weightedMin,
  channel: 'ALL', isCustom: true, parentSlotId
}
```

`getEffectivePgmSlots(pgmSlots, customSlots)`: 원본에서 deleted 제거 → override 적용 → isCustom 슬롯 삽입 → dateKey+timeText 정렬.

---

### 2026-05-23 — 팀별 관점 차트 도메인 캡 설계

**문제**: 문화서비스팀처럼 목표값이 전사 평균 대비 2~3배 이상인 팀이 있으면 XAxis가 늘어나 다른 팀 바가 모두 납작해짐.

**해결**: `domain = [0, ceil(전사목표 × 1.5)]` + `allowDataOverflow={true}`.

- 캡 초과 바는 차트 끝에서 잘리고, 인사이드 레이블로 실제 값 표시
- 목표 없는 팀(편성팀·미분류)은 전사 목표를 fallback 목표로 사용

---

## 개발 규칙

> **GAS·Firebase DB는 사전 확인 없이 건드리지 않는다.**  
> 데이터 구조 변경, Firebase 경로 추가·삭제, GAS 스크립트 수정이 필요해 보여도 먼저 팀에게 확인 후 진행한다.  
> 기능 문제는 최대한 프론트엔드(React/Zustand/컴포넌트 로직)에서 해결한다.

---

## 개선 필요 항목 (2026-05-23 감사 결과)

### [완료] HIGH — 중복 함수 / 유지보수 위험

| 항목                        | 파일                                                  | 내용                                                          |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| ~~`decodeMapKeys()` 중복~~  | ~~`sessionActions.js:17`, `firebaseSubscribe.js:17`~~ | ✅ `src/utils/firebaseKey.js`로 통합 완료 (2026-05-23)        |
| ~~Firebase 키 인코딩 분산~~ | ~~`blockBuilders.js:193`, `itemActions.js:102`~~      | ✅ `encodeKey`/`decodeKey` 단일 모듈로 통합 완료 (2026-05-23) |

### [완료] HIGH — 협업 Race Condition

| 항목                          | 파일                         | 내용                                                             |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| ~~CA/IP 분리 3회 순차 write~~ | ~~`blockActions.js`~~        | ✅ `update(weekKey, {...})` 원자적 쓰기로 교체 완료 (2026-05-23) |
| ~~채널 변경 다중 write~~      | ~~`blockActions.js:74-102`~~ | ✅ 동일 처리 완료 (2026-05-23)                                   |
| ~~시간 분할/삭제 다중 write~~ | ~~`timeSlotActions.js`~~     | ✅ 동일 처리 완료 (2026-05-23)                                   |

### [완료] HIGH — 그리드 렌더 성능

| 항목                                  | 파일                    | 내용                                   |
| ------------------------------------- | ----------------------- | -------------------------------------- |
| ~~`ScheduleBlock` React.memo 미적용~~ | ~~`ScheduleBlock.jsx`~~ | ✅ `React.memo` 적용 완료 (2026-05-23) |
| ~~`SlotRow` React.memo 미적용~~       | ~~`SlotRow.jsx`~~       | ✅ `React.memo` 적용 완료 (2026-05-23) |

### [완료] MEDIUM — Firebase 구독 해제 패턴

| 항목                | 파일                                                       | 내용                                                                 |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| ~~`off(ref)` 패턴~~ | ~~`firebaseSubscribe.js`, `usePresence.js`, `useChat.js`~~ | ✅ `onValue()` 반환 unsubscribe 함수 패턴으로 전환 완료 (2026-05-23) |

### [완료] MEDIUM — 번들 최적화

| 항목                      | 파일          | 내용                                                                     |
| ------------------------- | ------------- | ------------------------------------------------------------------------ |
| ~~탭별 코드 분할 미적용~~ | ~~`App.jsx`~~ | ✅ `React.lazy + Suspense` 적용. 4개 탭 별도 청크 분리 완료 (2026-05-23) |

### [미완료] MEDIUM — 코드 구조

| 항목                         | 파일                        | 내용                                                                                      |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| 순수 유틸이 hook 파일에 위치 | `usePerformanceMap.js`      | `normalizeDealType()`, `makePerfKey()`는 Hook이 아닌 순수 함수. `src/utils/` 로 이동 권장 |
| Optimistic update 롤백 없음  | `BlockEditModal.jsx:90-104` | Firebase write 전 setState → 실패 시 UI·DB 불일치. try/catch + 롤백 처리 필요             |

### [다음 패치 확인] uniqueKey 발급 체계 정리

| 항목                     | 파일                                                                                                                                    | 내용                                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| uniqueKey 발급 방식 통일 | `utils/uniqueKey.js`, `sessionActions.js`, `refreshActions.js`, `itemActions.js`, `blockActions.js`, `DraftSchedule.jsx`, `SlotRow.jsx` | 현재 `genKey()`/`Date.now()+Math.random()`/슬롯 기반 키/Firebase push key가 혼재되어 있음. 운영 중인 기존 세션의 `uniqueKey`, `entityProps`, `manualInputs`, `scheduleBlocks`는 마이그레이션하지 말고 그대로 유지. 다음 새 판 시작 전 신규 생성분부터 Firebase push key 기반으로 통일하는 방향 검토. |
| 전사블록 키 정책 확인    | `blockBuilders.js`, `SlotRow.jsx`                                                                                                       | 기본 `makeDefaultBlock()`은 아직 `uniqueKey: 0_${blockKey}` 슬롯 기반. 드래그 이동 후 빈 슬롯 채우기 액션은 `0_${Firebase push key}`로 변경됨. 다음 패치에서 전사블록 전체 정책을 슬롯 기반으로 둘지, 신규 엔티티 기반으로 둘지 결정 필요.                                                           |

---

## 설계 메모: 미편성 상품 관리 itemId/uniqueKey 병행 전환

작성일: 2026-05-29

### 현재 구버전 구조

현재 사이드바의 미편성 상품 목록은 `gasData/proposalItems`를 원본으로 사용한다.

- 원본 제안상품: `sessions/{weekKey}/gasData/proposalItems`
- 편성 여부 기록: `sessions/{weekKey}/scheduledItemIds/{itemId}`
- 화면 표시 목록: Zustand `proposalItems`

상품을 주간 편성표에 드롭하면 `scheduleItem(itemId)`가 실행된다.

```js
scheduledItemIds[itemId] = true;
proposalItems = proposalItems.filter((p) => p.itemId !== itemId);
```

이때 사이드바에서 카드가 사라지는 것은 Firebase 원본 목록에서 제거된 것이 아니라, 현재 브라우저의 Zustand state에서만 제거된 것이다. 따라서 브라우저를 닫았다 열거나 다른 사용자가 접속하면 `gasData/proposalItems`를 다시 로드하면서 이미 편성된 카드가 사이드바에 다시 보일 수 있다.

특히 같은 상품명(`[비에날씬]다이어트` 등)이 여러 장 있어도, 실제로는 각 카드가 별도 `uniqueKey`를 가진 독립 엔티티여야 한다. 지금 구조는 편성 상태가 `itemId` 중심이라 “같은 이름의 여러 카드 중 정확히 어느 카드가 편성됐는지”를 장기적으로 안정적으로 표현하기 어렵다.

### 개선 목표

모든 상품 카드가 다음 원칙을 지키게 한다.

- 선편성, 제안상품, 수동 추가, 복사, 시스템 생성 상품은 모두 `uniqueKey`를 가진다.
- 사이드바에서 보이는 미편성 여부는 카드 이름이 아니라 `uniqueKey` 기준으로 판단한다.
- 같은 상품명이 3장 있으면 3개의 독립 카드로 취급한다.
- 그중 1장을 편성하면 해당 `uniqueKey` 카드만 사이드바에서 사라지고, 나머지 2장은 남아야 한다.
- 이 상태는 현재 브라우저뿐 아니라 새로고침, 재접속, 다른 사용자 화면에서도 동일해야 한다.

### 왜 바로 전면 교체하지 않는가

기존 작업 세션에는 이미 `scheduledItemIds` 기반 데이터가 들어 있다.

바로 `scheduledUniqueKeys`만 사용하도록 바꾸면 다음 문제가 생길 수 있다.

- 기존 편성 블록은 `scheduledUniqueKeys`에 등록되어 있지 않아 사이드바에 다시 노출될 수 있다.
- 기존 반환/삭제/경쟁 해제 로직이 `scheduledItemIds`만 지우고 있어서 편성 상태가 꼬일 수 있다.
- 일부 refresh 경로에서 새 `uniqueKey`를 다시 발급하는 흐름이 남아 있어, 기존 편성 블록과 원본 카드 연결이 끊길 수 있다.
- 현재 작업 중인 세션을 마이그레이션하지 않고 전환하면 사용자가 이미 배치한 편성 데이터의 표시가 달라질 위험이 있다.

따라서 현 단계에서는 기존 세션 보호를 위해 `itemId`와 `uniqueKey`를 병행한다.

### 병행 전환 설계

새 Firebase 경로를 추가한다.

```text
sessions/{weekKey}/scheduledUniqueKeys/{uniqueKey}: true
```

편성 시에는 기존 경로와 새 경로를 모두 기록한다.

```text
scheduledItemIds/{itemId} = true
scheduledUniqueKeys/{uniqueKey} = true
```

사이드바 미편성 필터는 둘 중 하나라도 편성 상태면 숨긴다.

```js
const isScheduled =
  scheduledUniqueKeys[item.uniqueKey] || scheduledItemIds[item.itemId];

const unscheduledItems = allProposalItems.filter((item) => !isScheduled);
```

반환, 삭제, 경쟁 해제 시에는 둘 다 해제한다.

```text
scheduledItemIds/{itemId} = null
scheduledUniqueKeys/{uniqueKey} = null
```

이렇게 하면 기존 세션은 `scheduledItemIds`로 계속 보호되고, 새로 편성되는 카드부터는 `uniqueKey` 기준으로도 안정적으로 관리된다.

### 구현 시 변경해야 할 파일

- `src/store/useScheduleStore.js`
  - `scheduledUniqueKeys` 상태 추가
- `src/store/helpers/firebaseSubscribe.js`
  - `sessions/{weekKey}/scheduledUniqueKeys` 실시간 구독 추가
  - `scheduledItemIds` 구독은 유지
- `src/store/actions/itemActions.js`
  - `loadProposals()`에서 `scheduledItemIds`와 `scheduledUniqueKeys`를 모두 반영해 미편성 목록 필터링
  - `scheduleItem(itemId)`를 `scheduleItem(item)` 또는 `scheduleItem(itemId, uniqueKey)` 형태로 확장
  - 편성 시 두 경로 모두 저장
- `src/pages/DraftSchedule.jsx`
  - `scheduleItem(itemId)` 호출부에서 해당 item의 `uniqueKey`도 함께 전달
- `src/store/actions/blockActions.js`
  - `removeBlock`, `returnBlockToSidebar`, `releaseCompetition`, `restoreCompetitionItems`에서 `scheduledItemIds`와 `scheduledUniqueKeys` 모두 해제
- `src/store/actions/refreshActions.js`
  - 제안상품 갱신/전체 재동기화 시 기존 `itemId`와 매칭되는 `uniqueKey`를 최대한 보존
  - 새 `uniqueKey`를 무조건 재발급하지 않도록 주의

### 다음 버전에서 삭제 또는 전환할 항목

병행 기간이 끝나고 기존 세션 마이그레이션이 완료되면 다음 정리를 진행한다.

1. `scheduledItemIds` 의존 제거
   - 사이드바 필터, 반환, 삭제, 경쟁 해제에서 `scheduledItemIds` 기준 로직 제거
   - Firebase 경로 `sessions/{weekKey}/scheduledItemIds`는 읽기 fallback으로만 일정 기간 유지 후 삭제

2. `proposalItems` state 역할 분리
   - 현재는 `proposalItems`가 “원본 목록”이면서 “화면에 보이는 미편성 목록”처럼 쓰인다.
   - 다음 구조로 분리 권장:

```js
allProposalItems; // Firebase 원본 + entityProps 머지
unscheduledProposalItems; // scheduledUniqueKeys 기준으로 계산된 화면 목록
```

3. `itemId`는 GAS 원본 추적용으로 축소
   - `itemId`: GAS 행/원본 상품 추적용
   - `uniqueKey`: 앱 내부 카드 이동, 편성 여부, entityProps, manualInputs 기준

4. refresh uniqueKey 보존 규칙 확정
   - GAS 재동기화 시 `itemId`가 같으면 기존 `uniqueKey` 유지
   - 복사/수동추가/시스템생성은 항상 새 `uniqueKey` 발급
   - 기존 편성 블록의 `uniqueKey`는 재동기화로 변경하지 않음

### 주의 사항

- 기존 작업 세션에는 별도 마이그레이션을 즉시 수행하지 않는다.
- 병행 저장은 기존 작업을 깨지 않기 위한 과도기 전략이다.
- 마이그레이션을 진행할 경우, `scheduleBlocks`를 순회해 각 블록의 `uniqueKey`를 `scheduledUniqueKeys`에 채우는 별도 스크립트가 필요하다.

## 구현 메모: uniqueKey 발급 표준화

작성일: 2026-05-29

- `src/utils/uniqueKey.js`를 uniqueKey 단일 발급기로 사용한다.
- `genKey(prefix)`는 `{prefix}_{Firebase push key}` 형식으로 발급한다.
- prefix 규칙은 `0` 시스템/전사블록, `1` 제안상품/복귀/복사/수동추가, `2` 선편성, `3` 경쟁묶음이다.
- 컴포넌트에서 직접 `push(ref(db, 'entityKeys'))`를 호출하던 경로는 제거하고 `genKey()` 참조로 통일했다.
- 구버전 `gasData/proposalItems` 중 `uniqueKey`가 없는 항목은 제안상품 로드 시 `genKey('1')`로 보강하고 Firebase 원본 및 `entityProps`에 반영한다.
- 운영 중인 기존 `scheduleBlocks`, `manualInputs`의 키는 강제 재발급하지 않는다. 이미 저장된 키를 바꾸면 수기 입력/엔티티 속성 연결이 끊길 수 있기 때문이다.
- 마이그레이션 없이도 병행 구조는 앞으로 새로 편성되는 카드부터 문제를 줄인다.



보안 문제 해결이 필요하고(프론트에서 확인이 안되게) 