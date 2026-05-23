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
Firebase 경로: sessions/{weekKey}/...
글로벌 포인터: activeSession  (협업 자동 합류용)
```

## 실행 명령

```bash
npm run dev      # 개발 서버 (HMR)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
```

---

## 수정 이력

| 날짜 | 작업자 | 카테고리 | 내용 |
|------|--------|----------|------|
| 2026-05-22 | SeungHyun-111 | fix | split 슬롯 CA/IP 가중분 이중계산 — `makeDefaultBlock`이 CA·IP 채널에도 전체 `weightedMin`을 쓰는 버그. `splitWeightedMin` import 후 channel별 비례 분할값 적용. CA+IP 합 = 원래 슬롯 가중분 보장 (`blockBuilders.js`) |
| 2026-05-22 | SeungHyun-111 | fix | 편성비중 도넛차트 순서·편성팀 누락 — `isDefault` 필터 제거로 "편성팀" 포함, `sortedData` 단일 배열로 내·외 링 12시 기점 순서 통일 (`useRatioStats.js`, `RatioDonutChart.jsx`) |
| 2026-05-22 | SeungHyun-111 | fix | 편성비중 목표값 미인식 — GAS `teamName`("영업1팀")과 block `mdTeam`("영업1") 간 "팀" 접미사 불일치로 `targetMap` 조회 실패. `targetMap` 생성 시 원본·변형 양방향 등록으로 해결 (`ScheduleRatio.jsx`) |
| 2026-05-22 | SeungHyun-111 | feat | 편성 그리드 flexible 높이 — 슬롯이 화면보다 적으면 자동으로 꽉 채움, 많으면 MIN_ROW_HEIGHT(28px) 기준 스크롤. `ScheduleGrid.jsx`에 bodyRef ResizeObserver 추가, unitHeight 동적 계산 |
| 2026-05-22 | SeungHyun-111 | feat | Firebase `activeSession` 추가 — 협업 시 자동 세션 동기화. 누군가 새 편성을 시작하면 모든 접속자가 같은 세션에 자동 합류. localStorage 의존 제거, Firebase를 공유 진입점으로 사용 |
| 2026-05-22 | SeungHyun-111 | fix | split 슬롯 드래그·드롭 및 사이드바 블록 복구 |
| 2026-05-22 | SeungHyun-111 | fix | index.html 및 스타일 오류 수정 |

---

## 주요 이슈 / 결정 기록

### 2026-05-22 — activeSession 협업 동기화

**문제**: `lastWeekKey`를 `localStorage`에 저장 → 브라우저 단위 저장이라 다른 팀원 기기에는 없음.  
한 명이 편성을 시작해도 나머지는 "편성 데이터가 없습니다" 화면만 봄.

**해결**: Firebase 루트에 `activeSession` 노드 추가.
- "새 편성 시작"(resetSession) 완료 시 `activeSession`에 weekKey 기록
- 앱 진입 시 localStorage 없으면 Firebase `activeSession` 읽어 자동 합류
- `onValue` 리스너로 세션 변경 시 모든 접속자 화면 자동 전환

**적용 파일**:
- `src/store/actions/sessionActions.js` — resetSession 완료 후 activeSession write
- `src/pages/DraftSchedule.jsx` — 진입 시 activeSession 읽기 + 실시간 리스너

| 2026-05-22 | SeungHyun-111 | feat | 실적예상값 페이지 전면 개편 — 요약카드(총취급고·한익·분당취급고·한익·미입력수), 일자별/팀별·카테고리별 Bar 차트(recharts), 그룹별 분당취급고·분당한익 요약표, 직전실적 미입력 블록 별도 알림 섹션, 전체 상세 테이블 인라인 수정(셀 클릭→입력→saveManualInput) 포함 (`PerformanceForecast.jsx`) |
| 2026-05-22 | SeungHyun-111 | fix | 선편성 블록 경쟁 생성 버그 2종 — ①`handleBlockDrop`이 컴포넌트 클로저의 stale `scheduleBlocks`를 참조해 선편성 블록을 못 찾는 문제: `getState().scheduleBlocks`로 교체(`DraftSchedule.jsx`). ②`SlotRow` 블록-블록 드래그가 경쟁 로직 없이 덮어쓰는 문제: 타깃 슬롯에 비디폴트 블록이 있으면 경쟁 블록 생성으로 분기 추가(`SlotRow.jsx`). isPreSchedule: false 명시로 리프레시 시 보호 목록 포함 |
| 2026-05-22 | SeungHyun-111 | fix | 선편성 블록 경쟁 생성 후 isPreSchedule 잔류 — saveBlock이 Firebase update(병합)를 사용하므로 선편성 블록에서 경쟁 생성 시 isPreSchedule: true가 남아, refreshActions의 protectedBlocks 필터(!b.isPreSchedule)에서 제외돼 다음 리프레시 시 경쟁 블록이 선편성으로 덮어써지는 버그. 경쟁 생성 패치에 isPreSchedule: false 명시 추가(`DraftSchedule.jsx`) |
| 2026-05-22 | SeungHyun-111 | fix | 편성비중 totalTarget → totalSlotWeighted 기준 통일 — GAS weeklyTarget 합계 대신 주간 슬롯 가중분 합계를 전체 목표 기준으로 사용 (`ScheduleRatio.jsx`) |
| 2026-05-22 | SeungHyun-111 | fix | ghost default 블록 Firebase 자동 정리 — splitSlots에 있는 슬롯의 isDefault 블록을 _loadFromFirebase 진입 시 자동 삭제 (`sessionActions.js`) |
| 2026-05-22 | SeungHyun-111 | feat | 실적예상값 페이지 Hero 지표 개편 — 분당취급고·분당한익을 HeroCard(대형 숫자+진행바)로 최상단 강조. EffBar 컴포넌트(green≥90%/yellow≥65%/red)로 효율 시각화. 편성 효율(편성 가중분/전체 슬롯 가중분) 별도 HeroCard 추가 (`PerformanceForecast.jsx`) |
| 2026-05-22 | SeungHyun-111 | feat | 실적예상값 차트 2×2 분리 — 취급고 볼륨과 분당 효율을 단일 차트에 혼합 시 시각화 왜곡 문제로 4개 카드로 분리: ①일자별 취급고(볼륨) ②팀/카테고리별 목표 vs 편성 가중분(TargetBar 진행바) ③일자별 분당취급고/한익(효율) ④팀/카테고리별 분당취급고/한익(가로 bar chart). 팀별에서만 목표 가중분(weightedMinTargets) 진행바 표시, 카테고리는 비중 표시 (`PerformanceForecast.jsx`) |
| 2026-05-22 | SeungHyun-111 | fix | 테이블 헤더 정렬 통일 — 숫자 컬럼 헤더 textAlign을 데이터 셀과 동일하게 right/center로 맞춤. 열 정의 배열(groupCols, detailCols, missingCols)에서 align 속성으로 makeTh 함수 일괄 적용 (`PerformanceForecast.jsx`) |
| 2026-05-22 | SeungHyun-111 | docs | 설명서 로컬 캐시 vs Firebase DB 섹션 추가 — localStorage(lastWeekKey·theme·userName)는 브라우저 단위·팀 미공유, Firebase(activeSession·sessions/{weekKey})는 팀 전체 실시간 공유임을 명시. 잘못된 Firebase 직접 수정 주의 안내 포함 (`HelpPage.jsx`) |

| 2026-05-23 | SeungHyun-111 | feat | 탭명 '실적 예상값' → '시뮬레이션' 변경 (`App.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | [편성팀] 디폴트 블록 완전 카드화 — `isDefault: false` + `memoCode: '[전사블록]'` 설정. 드래그·사이드바 반환·경쟁 생성 등 일반 블록과 동일하게 동작. 모든 컴포넌트에서 `isDefault` 조건 제거, `isPgmTeam`(pgmCodeName==='[편성팀]') 기준으로 스타일만 별도 적용. ghost 블록 정리 조건도 `isDefault→pgmCodeName==='[편성팀]'`로 변경 (`blockBuilders.js`, `sessionActions.js`, `ScheduleBlock.jsx`, `SlotRow.jsx`, `Sidebar.jsx`, `blockActions.js`) |
| 2026-05-23 | SeungHyun-111 | feat | 시뮬레이션 페이지 Hero 카드 전면 개편 — ①분당취급고·②분당한익 달성률 progress bar를 전사 목표(companyTotal.salesPerMin/profitPerMin) 기준으로 변경. ③전사블록 시뮬레이션 카드: 편성팀 슬롯 수·가중분·비중 표시 + 분당취급고/한익 실시간 입력(debounce 500ms→saveManualInput). placeholder = 전사 목표값. 탭 전환 후 입력값 자동 복원(useEffect + pgmTeamRows[0].perfKey 기반 manualInputs 조회) (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 일자별 차트 개선 — 전사 목표 빨간 기준선(ReferenceLine) 추가. 막대 상단 데이터 레이블(만원 단위, 소수점 1자리). Y축 도메인 동적 계산(max(dataMax, 전사목표) × 1.12)으로 목표선 잘림 방지 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 총 예상취급고/한익 목표 역산 표시 — 전사 분당목표 × 전체 슬롯 가중분으로 주간 목표 역산, 달성률 % 보조 요약카드에 표시 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 팀별 볼륨 바 분리 — 취급고·한계이익 카드 각각 분리(위아래 배치), groupBy 토글 헤더에서 공유. 전사블록 제외 스위치 페이지 상단 추가(excludePgmTeam) (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 팀별 관점 차트 개선 — XAxis 캡 전사목표×1.5 + `allowDataOverflow`로 실제 클리핑 적용. 목표 없는 팀(편성팀·미분류 등)은 전사 목표로 fallback(effectiveTargetSalesPerMin/ProfitPerMin). 캡 초과 바에 인사이드 레이블(#.#만). 팀명 폰트 15px/YAxis 너비 75px. 바 높이 1.5배·barCategoryGap 16% (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 일자별 차트 팀별 툴팁 — 호버 시 팀별 취급효율/한익효율 + 비중 분해 표시. dailyTeamData useMemo(date×team 교차 집계) + DailyTeamTip 컴포넌트 추가 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 일자별 클릭 필터 — 막대 클릭 시 해당 일자만 필터(selectedDate). displayRows = rows.filter(dateKey). Hero·요약·볼륨바·팀별관점·효율테이블·상세테이블 전체 연동. 선택된 바 노란 하이라이트·미선택 dim. 동일 일자 재클릭 또는 "전체 보기" 버튼으로 해제 (`PerformanceForecast.jsx`) |

---

## 주요 이슈 / 결정 기록

### 2026-05-23 — [편성팀] 블록 isDefault 제거 경위

**문제**: `isDefault: true` 인 블록은 드래그·사이드바 반환·팀 필터 dim 등 모든 상호작용에서 제외돼 있었음.  
편성팀 슬롯을 시뮬레이션에 포함하고 실제 블록처럼 움직이게 하려면 일반 블록과 동일하게 취급해야 했음.

**해결**: `isDefault: false` 로 변경, 식별은 `pgmCodeName === '[편성팀]'`(isPgmTeam)로만 수행.  
스타일만 `var(--bg3)/var(--text3)` 회색 계열 유지, 나머지 동작은 일반 블록과 동일.

**perfKey 주의**: `makePerfKey('', '[편성팀]')` = `normalizeDealType('') + '[편성팀]'` = `'[위][편성팀]'`.  
manualInputs 조회 시 `'[편성팀]'`이 아닌 `pgmTeamRows[0]?.perfKey` 로 참조해야 함.

### 2026-05-23 — 팀별 관점 차트 도메인 캡 설계

**문제**: 문화서비스팀처럼 목표값이 전사 평균 대비 2~3배 이상인 팀이 있으면 XAxis가 늘어나 다른 팀 바가 모두 납작해짐.

**해결**: `domain = [0, ceil(전사목표 × 1.5)]` + `allowDataOverflow={true}`.  
- 캡 초과 바는 차트 끝에서 잘리고, 인사이드 레이블로 실제 값 표시
- 목표 없는 팀(편성팀·미분류)은 전사 목표를 fallback 목표로 사용 (avgGroupSalesPerMin 아님)

---

## 개발 규칙

> **GAS·Firebase DB는 사전 확인 없이 건드리지 않는다.**
> 데이터 구조 변경, Firebase 경로 추가·삭제, GAS 스크립트 수정이 필요해 보여도 먼저 팀에게 확인 후 진행한다.
> 기능 문제는 최대한 프론트엔드(React/Zustand/컴포넌트 로직)에서 해결한다.

| 2026-05-23 | SeungHyun-111 | feat | [편성팀] 아이템 사이드바 카드화 — 세션 초기화 시 `[편성팀]/[위]/[전사블록]` 아이템 10개를 proposalItems에 자동 추가(`PGM_TEAM_ITEMS`). 이후 일반 제안상품과 동일하게 드래그·편성·반환 가능. 기존 `buildDefaultBlocks`(빈 슬롯 자동 채움) 완전 제거 → 선편성 외 모든 슬롯 공란 (`sessionActions.js`) |
| 2026-05-23 | SeungHyun-111 | feat | 사이드바 카드 우클릭 컨텍스트 메뉴 — "복사" / "삭제" 메뉴 추가. 복사: `duplicateProposalItem`(Firebase proposalItems 배열에 append + 로컬 state 반영). 삭제: `deleteProposalItem`(_fbIdx 기반 Firebase null 처리 + 로컬 state 제거). `useEffect`로 외부 클릭 시 메뉴 닫기 (`ProductCard.jsx`, `itemActions.js`) |
| 2026-05-23 | SeungHyun-111 | fix | 시뮬레이션 페이지 하단 2섹션 미렌더링 — ①`DailyTeamTip` 내 `.map()` Fragment에 key 누락(`<>` → `<Fragment key={t.name}>`)으로 React 19 렌더 크래시. ②외부 div에 `display:flex + height:100% + overflowY:auto` 동시 적용으로 스크롤 불가. 외부(스크롤 컨테이너)·내부(flex 레이아웃) div 분리로 해결 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 시뮬레이션 테이블 정렬·리사이즈 — 직전실적미확인·편성별 실적 상세 두 테이블에 컬럼 헤더 클릭 정렬(▲▼⇅), 컬럼 우측 드래그 핸들 너비 조절 추가. 첫 드래그 시 모든 컬럼 offsetWidth 스냅샷 → `table-layout:fixed` 전환. 기본 상태는 `table-layout:auto + width:100%`로 페이지 폭 자동 채움. `overflow:hidden + textOverflow:ellipsis`로 줄바꿈 없이 우측 클리핑 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | remove | 팀별 분당 효율 요약 테이블 삭제 — 요청 없이 포함된 섹션. `groupCols`, `makeThStyle` 함께 제거 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | fix | 직전실적미확인 섹션 항상 펼침 — 아코디언 토글(showMissing state) 제거, 항상 열린 상태 (`PerformanceForecast.jsx`) |
| 2026-05-23 | SeungHyun-111 | feat | 시간 분할·삭제 기능 — Firebase `sessions/{weekKey}/customSlots` 경로 신설. GAS 원본 pgmSlots 보존하며 오버라이드 레이어로 관리. **시간 분할**: 시간 라벨 우클릭 → "시간 분할" → 새 시작시간 입력 모달(실시간 미리보기: 앞/뒤 분·WM). 확인 시 원본 슬롯 duration 단축 + customSlots에 새 슬롯 생성. **시간 삭제**: 해당 슬롯 제거, 앞 슬롯이 duration+WM 흡수. CA/IP 채널분리 슬롯도 동일 처리(블록 WM 재계산). `getEffectivePgmSlots` 유틸리티로 pgmSlots+customSlots 병합·시간순 정렬. customSlots Firebase 실시간 구독 추가. 커스텀 슬롯은 파란 점선·파란 시간으로 시각 구분 (`timeSlotActions.js`, `effectiveSlots.js`, `ScheduleGrid.jsx`, `sessionActions.js`, `firebaseSubscribe.js`, `useScheduleStore.js`) |
| 2026-05-23 | SeungHyun-111 | fix | 시간 라벨 정렬·너비 — `TIME_COL_WIDTH` 34→36px, `justifyContent:flex-start+paddingLeft` → `center` 가운데 정렬, `overflow:hidden`으로 넘침 방지, `letterSpacing:-0.3px`으로 폰트 밀집 (`ScheduleGrid.jsx`) |

---

## 주요 이슈 / 결정 기록

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

**Firebase undefined 제약**: Firebase는 `undefined` 값을 직렬화 거부. 조건부 스프레드(`prevOv.isCustom ? {...prevOv, ...} : {durationMin, weightedMin}`)로 undefined 필드 원천 차단.

---

## 향후 과제

- [ ] 세션 히스토리 목록 UI (과거 주차 접근)
- [ ] activeSession 변경 시 토스트 알림 ("새 편성이 시작되었습니다")
- [ ] 오프라인 복구 처리
