# 방송 편성 작업판 (Draft Schedule)

React 19 + Vite 기반 TV 방송 편성 협업 SPA.

---

## 개발 명령어

```bash
npm run dev       # Vite 개발 서버 (HMR)
npm run build     # 프로덕션 빌드
npm run lint      # ESLint 검사
npm run preview   # 프로덕션 빌드 미리보기
```

---

## 작업 이력

### 완료

#### 조직명 정렬 — 편성팀 항상 맨 아래
- 영향 파일: `ScheduleRatio.jsx`, `RatioTable.jsx`, `RatioDonutChart.jsx`, `RatioPgmCount.jsx`, `ScheduleStatus.jsx`, `exportUtils.js`, `PerformanceForecast.jsx`
- 모든 팀 정렬 로직에서 `편성팀`을 항상 마지막으로 고정. 나머지는 기존 기준(가중분/건수 내림차순) 유지.

#### 팀명 정규화 일관성 확보
- 신규 파일: `src/utils/teamName.js`
- `saveBlock`, `changeBlockChannel` (`blockActions.js`) — 저장 시 `mdTeam`/`orgName` 자동 정규화
- `BlockEditModal.jsx` — 폼 초기값 정규화
- `firebaseSubscribe.js` — 실시간 구독 수신 시 정규화 적용
- `sessionActions.js` — Firebase 로드 시 정규화 + `subscribeRealtimePaths`에 `getState` 전달

#### 전사블록 시뮬레이션 조건 수정 (`PerformanceForecast.jsx`)
- 기존: `pgmTeamRows[0]?.perfKey` (첫 번째 편성팀 행의 perfKey 하나에만 저장)
- 변경: `pgmCodeName === '[편성팀]' && memoCode === '[전사블록]'` 조건인 블록 전체에 루프로 저장
- 결과: 이전에는 첫 번째 편성팀 블록과 같은 pgmCodeName을 가진 블록만 반영되던 문제 수정

#### summary 슬롯 카운트 계산 수정 (`PerformanceForecast.jsx`)
- 분할 슬롯(CA/IP)을 2칸으로 카운트하도록 `getEffectivePgmSlots` 적용 (엑셀 내보내기 방식과 통일)

---

### 미완료 (다음 작업)

#### manualInputs 키 체계 전면 재설계
- **배경**: 현재 `manualInputs`가 `perfKey`(pgmCodeName+dealType 조합) 기준으로 저장되어, 같은 상품코드의 다른 슬롯에도 수동 실적이 공유되는 구조적 버그 존재
- **의도**: 슬롯/카드 각각이 개별 속성을 가져야 함. 같은 상품코드여도 PGM마다 실적이 다를 수 있음
- **설계 방향**:
  - `loadInitData`에서 GAS 데이터를 Firebase에 최초 저장 시 `uniqueKey` 필드 생성
  - 키 규칙: 제안상품 `1_{uuid}`, 선편성 `2_{uuid}`, 복사/수동생성 `3_{uuid}`
  - `manualInputs` 저장/조회 키를 `perfKey` → `uniqueKey`로 전면 교체
  - `perfMap`은 초기 실적 참조용이므로 `perfKey` 기준 유지
  - 수동 입력 없고 perfMap 실적도 없으면 → 0 처리 (현재는 missingPerf로 별도 표시)
- **영향 파일**: `sessionActions.js`, `blockBuilders.js`, `calcForecast` (PerformanceForecast.jsx), `calcForecastLocal` (exportUtils.js), `BlockEditModal.jsx`, `grade.js`, `RatioPgmCount.jsx`, `SearchPanel.jsx`
- **주의**: 기존 세션의 `manualInputs` 데이터(perfKey 기준)는 신규 키 체계와 호환 안 됨 → 신규 세션부터 적용
