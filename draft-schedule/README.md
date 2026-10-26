# 방송 편성 작업판 (Draft Schedule)

React 19 + Vite 기반 TV 방송 편성 협업 SPA.

---

## ⚡ 개발 원칙 — uniqueKey 기반 엔티티 속성 관리

### 핵심 규칙
모든 카드(제안상품·편성블록·선편성)는 `uniqueKey`를 고유 식별자로 가진다.  
`uniqueKey`에 귀속되는 **엔티티 속성**은 Firebase `entityProps/{uniqueKey}` 에 단 한 곳에만 저장되며, 어떤 화면에서든 이 값을 읽는다.

### 엔티티 속성 목록 (`src/utils/mergeEntity.js` → `ENTITY_FIELDS`)
`pgmCodeName`, `mdTeam`, `orgName`, `mdCategory`, `dealType`, `dealTypeConverted`, `dealTypeChar`, `memoCode`, `scheduleComment`, `annotation`, `newProductType`, `perfKey`

### 새 기능 개발 시 반드시 따를 순서
1. **속성이 필요한가?** → `ENTITY_FIELDS`에 있는지 먼저 확인
2. **없으면** → `ENTITY_FIELDS`에 추가하고 `extractEntityFields`가 자동 포함하도록 처리
3. **저장** → `saveEntityProps(uniqueKey, { 필드: 값 })` 사용. `saveBlock`에 엔티티 필드를 섞지 말 것
4. **읽기** → `scheduleBlocks`와 `proposalItems`는 이미 entityProps가 머지된 상태. 별도 조회 불필요
5. **절대 금지** → 화면마다 엔티티 속성을 직접 덮어쓰거나, 변환 경로에서 필드를 수동으로 나열해 복사하는 패턴

### 데이터 흐름
```
Firebase entityProps/{uniqueKey}
  ↓ (실시간 구독, firebaseSubscribe.js)
Zustand entityProps 상태
  ↓ (scheduleBlocks 구독 시 자동 머지)
scheduleBlocks / proposalItems (이미 merged)
  ↓
모든 컴포넌트 — 그냥 block.memoCode 읽으면 됨
```

---

## 개발 명령어

편성코드 DB 로그인이 필요한 경우 `.env.example`을 `.env.local`로 복사하고 승인된 계정 정보를 입력합니다. `.env.local`은 Git에 포함되지 않습니다. `VITE_` 환경변수는 클라이언트 번들에 들어가므로 운영 환경에서는 별도의 인증 구조가 필요합니다.

```bash
pnpm run dev       # Vite 개발 서버 (HMR)
pnpm run build     # 프로덕션 빌드
pnpm run lint      # ESLint 검사
pnpm run preview   # 프로덕션 빌드 미리보기
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
