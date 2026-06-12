# 실적 테이블 기준 정리

작성일: 2026-06-12

## 공통 결론

편성된 블록은 거의 다 같은 “최종 실적값”을 본다.

최종 실적값 우선순위:

1. 실제실적: 같은 `perfKey` + 같은 방송일시의 실적
2. 수기실적: `manualInputs[uniqueKey]`
3. 직전실적: 같은 `perfKey` 중 편성일시 이전 또는 같은 시각의 가장 최근 실적
4. fallback: legacy `perfMap[perfKey]`가 편성일시보다 과거이면 사용
5. 없으면 0

다만 화면별 차이는 “최종 실적값을 어떻게 평균에 넣느냐”다.

- 어떤 테이블은 실적 미입력 블록의 실적을 0으로 두고 가중분도 평균 분모에 포함한다.
- 어떤 테이블은 실적 미입력 블록의 실적을 0으로 보지만, 평균 계산에서는 가중분까지 제외한다.
- 미편성 상품은 방송일시가 없으므로 직전실적 기준을 만들 수 없어 최신실적을 본다.

## 속성값 기준

| 출처 | 취급/분 속성 | 한익/분 속성 | 위치 |
| --- | --- | --- | --- |
| 실제실적 | `salesPerWeightedMin` | `profitPerWeightedMin` | `performanceHistoryByKey[perfKey]` 중 `broadcastTimestamp === blockTimestamp` |
| 직전실적 | `salesPerWeightedMin` | `profitPerWeightedMin` | `performanceHistoryByKey[perfKey]` 중 `broadcastTimestamp <= blockTimestamp`인 가장 최근 row |
| 최신실적 | `salesPerWeightedMin` | `profitPerWeightedMin` | `latestPerfByKey[perfKey]` 또는 fallback `perfMap[perfKey]` |
| 수기실적 | `expectedSalesPerWeightedMin` | `expectedProfitPerWeightedMin` | `manualInputs[uniqueKey]` |

코드에서 쓰는 최종값:

| 의미 | 코드상 이름 |
| --- | --- |
| 최종 취급/분 | `sp`, `salesPerMin` |
| 최종 한익/분 | `pp`, `profitPerMin` |
| 예상 취급고 | `sales`, `expectedSales = weightedMin * sp` |
| 예상 한익 | `profit`, `expectedProfit = weightedMin * pp` |
| 평균 분모로 쓰는 가중분 | `wm`, `perfWm`, `metricWeight` 등 화면별로 다름 |

## 수기실적과 직전실적 혼합 여부

최종 실적값은 취급/분과 한익/분을 각각 따로 고른다.

예를 들어 수기 입력이 취급/분만 있고 한익/분은 비어 있으면:

- 취급/분: 수기실적 사용
- 한익/분: 직전실적 사용

반대로 한익/분만 수기 입력되어 있으면:

- 취급/분: 직전실적 사용
- 한익/분: 수기실적 사용

같은 방송일시의 실제실적이 있으면 수기실적보다 실제실적이 우선된다.

## 전체 테이블 요약

| 화면 | 테이블 | 대상 | 실적 출처 | 노출되는 가중분 | 평균 분모에 쓰는 가중분 | 아무 실적도 없으면 |
| --- | --- | --- | --- | --- | --- | --- |
| 검색 패널 | 거래형태별 실적 | 검색된 편성 블록 | 실제실적 → 수기실적 → 직전실적 → fallback | 그룹 전체 `sum(weightedMin)` | 실적 있는 블록만 `perfWm += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분에는 포함, 평균 분모에서는 제외 |
| 검색 패널 | 채널별 실적 | 검색된 편성 블록 | 실제실적 → 수기실적 → 직전실적 → fallback | 그룹 전체 `sum(weightedMin)` | 실적 있는 블록만 `perfWm += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분에는 포함, 평균 분모에서는 제외 |
| 시뮬레이션 | 전체 요약 카드 | 편성 블록 전체 | 실제실적 → 수기실적 → 직전실적 → fallback | 전체 `sum(weightedMin)` | 전체 `sum(weightedMin)` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분과 평균 분모 모두 포함 |
| 시뮬레이션 | 일자별 차트/집계 | 편성 블록을 일자별 그룹 | 실제실적 → 수기실적 → 직전실적 → fallback | 일자별 `sum(weightedMin)` | 일자별 `sum(weightedMin)` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분과 평균 분모 모두 포함 |
| 시뮬레이션 | 팀별 테이블/차트 | 편성 블록을 팀별 그룹 | 실제실적 → 수기실적 → 직전실적 → fallback | 팀별 `sum(weightedMin)` | 팀별 `sum(weightedMin)` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분과 평균 분모 모두 포함 |
| 시뮬레이션 | 카테고리별 테이블/차트 | 편성 블록을 카테고리별 그룹 | 실제실적 → 수기실적 → 직전실적 → fallback | 카테고리별 `sum(weightedMin)` | 카테고리별 `sum(weightedMin)` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분과 평균 분모 모두 포함 |
| 시뮬레이션 | 직전실적 미확인 테이블 | `missingPerf === true`인 블록 | 실적 없음 표시용 | 행별 `weightedMin` | 이 테이블 자체는 평균 없음 | 취급/분 0, 한익/분 0. 다른 시뮬레이션 평균에서는 가중분 포함 |
| 시뮬레이션 | 편성별 실적 상세 | 편성 블록 행 단위 | 실제실적 → 수기실적 → 직전실적 → fallback | 행별 `weightedMin` | 이 테이블 자체는 평균 없음 | 취급/분 0, 한익/분 0, 예상액 0. 다른 시뮬레이션 평균에서는 가중분 포함 |
| 편성비중 하단 | 채널별 실적 | 유효 슬롯의 편성 블록 | 실제실적 → 수기실적 → 직전실적 → fallback | 셀/행/합계 전체 `sum(weightedMin)` | 실적 있는 블록만 `perfWm += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분에는 포함, 평균 분모에서는 제외 |
| 편성비중 하단 | 거래형태별 실적 | 유효 슬롯의 편성 블록 | 실제실적 → 수기실적 → 직전실적 → fallback | 셀/행/합계 전체 `sum(weightedMin)` | 실적 있는 블록만 `perfWm += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분에는 포함, 평균 분모에서는 제외 |
| 편성비중 하단 | 영상구분별 실적 | 유효 슬롯의 편성 블록 | 실제실적 → 수기실적 → 직전실적 → fallback | 셀/행/합계 전체 `sum(weightedMin)` | 실적 있는 블록만 `perfWm += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분에는 포함, 평균 분모에서는 제외 |
| 편성현황 팀별 | 팀요약: 편성완료 | 편성완료 row | 실제실적 → 수기실적 → 직전실적 → fallback | 편성완료 `sum(weightedMin)` | 편성완료 `metricWeight += weightedMin` | `sp=0`, `pp=0`, 예상액 0. 노출 가중분과 평균 분모 모두 포함 |
| 편성현황 팀별 | 팀요약: 미편성 | 미편성 row | 수기실적 → 최신실적 | 가능 가중분 `sum(availableWeightedMin1)` | 평균 분모에 쓰지 않음 | `sp=0`, `pp=0`. 노출 가능 가중분은 표시되지만 팀요약 실적 평균에서는 제외 |
| 편성현황 팀별 | 전체 테이블: 편성완료 행 | 편성완료 row | 실제실적 → 수기실적 → 직전실적 → fallback | 행별 `weightedMin` | 이 테이블 자체는 평균 없음. 팀요약에서는 포함 | 취급/분 0, 한익/분 0 |
| 편성현황 팀별 | 전체 테이블: 미편성 행 | 미편성 row | 수기실적 → 최신실적 | 행별 `availableWeightedMin1` | 이 테이블 자체는 평균 없음. 팀요약에서는 제외 | 취급/분 0, 한익/분 0 |

핵심 차이:

- 검색 패널과 편성비중 하단은 화면에 보이는 가중분은 전체 가중분이지만, 평균 분모는 실적 있는 블록의 가중분만 쓴다.
- 시뮬레이션과 편성현황 팀요약의 편성완료는 화면에 보이는 가중분과 평균 분모 가중분이 같다.
- 편성현황 팀요약의 미편성 가능 가중분은 표시만 되고 실적 평균 분모에는 들어가지 않는다.

## 가중분 노출값 vs 평균 분모 계산식

| 화면/테이블 | 노출되는 가중분 | 분모 가중분 | 0 가중분 1 보정 | 로직 |
| --- | --- | --- | --- | --- |
| 검색 패널: 거래형태별 실적 | 실적없는 블록 포함 `sum(weightedMin)` | 실적없는 블록 제외 `sum(weightedMin where sp > 0 || pp > 0)` | 미적용. 원본 `weightedMin` 사용 | 취급/분 평균 = 실적있는 블록의 `sum(weightedMin * sp)` / 실적없는 블록 제외 가중분. 한익/분도 동일 |
| 검색 패널: 채널별 실적 | 실적없는 블록 포함 `sum(weightedMin)` | 실적없는 블록 제외 `sum(weightedMin where sp > 0 || pp > 0)` | 미적용. 원본 `weightedMin` 사용 | 취급/분 평균 = 실적있는 블록의 `sum(weightedMin * sp)` / 실적없는 블록 제외 가중분. 한익/분도 동일 |
| 시뮬레이션: 전체 요약 | 실적없는 블록 포함 `sum(effectiveWeightedMin)` | 실적없는 블록 포함 `sum(effectiveWeightedMin)` | 적용. 일반 팀 `weightedMin=0`이면 1, 편성팀은 0 유지 | 취급/분 평균 = 실적없는 블록은 `sp=0`으로 둔 전체 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 포함 전체 가중분 |
| 시뮬레이션: 일자별 | 실적없는 블록 포함 일자별 `sum(effectiveWeightedMin)` | 실적없는 블록 포함 일자별 `sum(effectiveWeightedMin)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 일자별 취급/분 = 실적없는 블록은 `sp=0`으로 둔 일자별 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 포함 일자별 가중분 |
| 시뮬레이션: 팀별 | 실적없는 블록 포함 팀별 `sum(effectiveWeightedMin)` | 실적없는 블록 포함 팀별 `sum(effectiveWeightedMin)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 팀별 취급/분 = 실적없는 블록은 `sp=0`으로 둔 팀별 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 포함 팀별 가중분 |
| 시뮬레이션: 카테고리별 | 실적없는 블록 포함 카테고리별 `sum(effectiveWeightedMin)` | 실적없는 블록 포함 카테고리별 `sum(effectiveWeightedMin)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 카테고리별 취급/분 = 실적없는 블록은 `sp=0`으로 둔 카테고리별 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 포함 카테고리별 가중분 |
| 시뮬레이션: 직전실적 미확인 | 행별 `effectiveWeightedMin` 표시/계산 기준 | 평균 없음 | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 실적없는 블록 목록 표시용. 이 블록들은 시뮬레이션 전체/일자별/팀별/카테고리별 평균에서는 `sp=0`, `pp=0`, 가중분 포함으로 계산됨 |
| 시뮬레이션: 편성별 실적 상세 | 행별 `effectiveWeightedMin` 표시/계산 기준 | 이 테이블 자체 평균 없음 | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 행별 예상취급고 = `effectiveWeightedMin * sp`. 실적없으면 `sp=0`이라 예상취급고 0. 다른 시뮬레이션 평균에서는 가중분 포함 |
| 편성비중 하단: 채널별 실적 | 실적없는 블록 포함 `sum(effectiveWeightedMin)` | 실적없는 블록 제외 `sum(effectiveWeightedMin where sp > 0 || pp > 0)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 취급/분 평균 = 실적있는 블록의 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 제외 가중분. 한익/분도 동일 |
| 편성비중 하단: 거래형태별 실적 | 실적없는 블록 포함 `sum(effectiveWeightedMin)` | 실적없는 블록 제외 `sum(effectiveWeightedMin where sp > 0 || pp > 0)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 취급/분 평균 = 실적있는 블록의 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 제외 가중분. 한익/분도 동일 |
| 편성비중 하단: 영상구분별 실적 | 실적없는 블록 포함 `sum(effectiveWeightedMin)` | 실적없는 블록 제외 `sum(effectiveWeightedMin where sp > 0 || pp > 0)` | 적용. 일반 팀 0은 1, 편성팀은 0 유지 | 취급/분 평균 = 실적있는 블록의 `sum(effectiveWeightedMin * sp)` / 실적없는 블록 제외 가중분. 한익/분도 동일 |
| 편성현황 팀별: 팀요약 편성완료 | 실적없는 편성완료 포함 `sum(weightedMin)` | 실적없는 편성완료 포함 `sum(weightedMin)` | 미적용. 원본 `weightedMin` 사용 | 취급/분 평균 = 실적없는 편성완료는 `sp=0`으로 둔 `sum(weightedMin * sp)` / 실적없는 편성완료 포함 가중분 |
| 편성현황 팀별: 팀요약 미편성 | 실적없는 미편성 포함 가능가중분 `sum(availableWeightedMin1)` | 평균 분모에 사용 안 함 | 미적용. 제안상품의 `availableWeightedMin1` 원본 사용 | 미편성은 실적 평균에서 제외. 가능가중분은 표시용이고 팀요약 취급/분/한익/분 평균에 들어가지 않음 |
| 편성현황 팀별: 전체 테이블 편성완료 행 | 행별 `weightedMin` 표시 | 이 테이블 자체 평균 없음 | 미적용. 원본 `weightedMin` 사용 | 행 표시용. 실적없으면 취급/분/한익/분 0. 팀요약 평균에서는 실적없는 편성완료도 가중분 포함 |
| 편성현황 팀별: 전체 테이블 미편성 행 | 행별 `availableWeightedMin1` 표시 | 이 테이블 자체 평균 없음 | 미적용. 제안상품의 `availableWeightedMin1` 원본 사용 | 행 표시용. 실적없으면 취급/분/한익/분 0. 팀요약 평균에서는 미편성 전체가 제외 |

## 화면별 상세

### 1. 검색 패널: 거래형태별 / 채널별 실적 테이블

파일: `src/components/schedule/SearchPanel.jsx`

대상:

- `scheduleBlocks` 중 검색어에 걸린 편성 블록
- `isDefault` 블록 제외

그룹:

- 거래형태별: `dealTypeConverted || dealType || '미지정'`
- 채널별: `CA`, `IP`, 그 외 `ALL`

실적 기준:

- 최종 실적값은 실제실적 → 수기실적 → 직전실적 → fallback → 0
- 미편성 상품 최신실적이 아니라 편성 블록의 방송일시 기준 실적

평균 처리:

- 실적이 없으면 해당 블록의 `sp`, `pp`는 0
- 하지만 평균 계산에서는 그 블록의 가중분을 제외
- 조건은 `sp > 0 || pp > 0`
- 평균 = `sum(weightedMin * sp) / perfWm`

### 2. 시뮬레이션 페이지

파일: `src/pages/PerformanceForecast.jsx`

대상:

- 기본적으로 `scheduleBlocks` 전체
- 전사블록 제외 옵션이 켜지면 편성팀 블록 제외

실적 기준:

- 최종 실적값은 실제실적 → 수기실적 → 직전실적 → fallback → 0

전체 요약:

- 총 예상취급고 = `sum(sp * weightedMin)`
- 총 예상한익 = `sum(pp * weightedMin)`
- 취급/분 평균 = `sum(sp * weightedMin) / sum(weightedMin)`
- 한익/분 평균 = `sum(pp * weightedMin) / sum(weightedMin)`

미입력 처리:

- 실적이 없으면 `sp=0`, `pp=0`
- 예상취급고/예상한익도 0
- 그래도 가중분은 평균 분모에 포함

팀별/카테고리별/일자별도 동일하다.

- 해당 그룹 안에서 `sum(sp * weightedMin) / sum(weightedMin)`
- 미입력 블록의 가중분도 해당 그룹 분모에 포함

### 3. 편성비중 하단: 채널별 / 거래형태별 / 영상구분별 실적

파일: `src/components/ratio/RatioPgmCount.jsx`

대상:

- `enrichedBlocks` 중 `!isDefault`
- 유효 슬롯 기준 편성 블록

행 기준:

- 팀별: `mdTeam || orgName || '미지정'`
- 카테고리별: `mdCategory || '미분류'`

컬럼:

- 채널별: `CA`, `IP`, 그 외 `ALL`
- 거래형태별: `dealTypeConverted || dealType || '미지정'`
- 영상구분별: `newProductType || '기존'`

실적 기준:

- 최종 실적값은 실제실적 → 수기실적 → 직전실적 → fallback → 0

평균 처리:

- 실적이 없으면 해당 블록의 `sp`, `pp`는 0
- 하지만 평균 계산에서는 그 블록의 가중분을 제외
- 조건은 `sp > 0 || pp > 0`
- 평균 = `sum(weightedMin * sp) / perfWm`

즉 검색 패널의 거래형태별/채널별 실적 테이블과 같은 방식이다.

### 4. 편성현황: 팀별

파일: `src/pages/ScheduleStatus.jsx`

#### 팀요약

대상:

- 편성완료 row + 미편성 row를 같이 보여줌
- 하지만 실적 평균에는 편성완료 row만 사용

편성완료 row 실적 기준:

- 실제실적 → 수기실적 → 직전실적 → fallback → 0

미편성 row 실적 기준:

- 수기실적 → 최신실적 → 0
- 방송일시가 없어서 직전실적 기준이 아님

팀요약 평균 처리:

- 편성완료 row만 평균에 포함
- 편성완료 row가 실적 미입력이면 `sp=0`, `pp=0`
- 그래도 그 row의 가중분은 `metricWeight`에 포함
- 미편성 row는 최신실적이 있어도 팀요약 실적 평균에는 제외

계산:

- 취급/분 평균 = `sum(편성완료 row의 sp * weightedMin) / sum(편성완료 row의 weightedMin)`
- 한익/분 평균 = `sum(편성완료 row의 pp * weightedMin) / sum(편성완료 row의 weightedMin)`

#### 전체 테이블

대상:

- 편성완료 row와 미편성 row를 한 테이블에 표시

편성완료 행:

- 취급/분/한익/분은 실제실적 → 수기실적 → 직전실적 → fallback → 0
- 가중분은 `weightedMin`

미편성 행:

- 취급/분/한익/분은 수기실적 → 최신실적 → 0
- 가중분은 `availableWeightedMin1`

주의:

- 한 테이블에 섞여 있지만 편성완료와 미편성의 실적 기준은 다르다.
- 편성완료는 방송일시 기준, 미편성은 최신실적 기준이다.

## 차이가 나는 핵심

같은 최종 실적값을 보더라도 평균 분모가 다르다.

| 방식 | 쓰는 화면 | 미입력 실적 | 미입력 가중분 |
| --- | --- | --- | --- |
| 실적 입력건 평균 | 검색 패널, 편성비중 하단 | 0 | 평균 분모에서 제외 |
| 전체 편성 예상 평균 | 시뮬레이션, 편성현황 팀요약 편성완료 | 0 | 평균 분모에 포함 |
| 표시만 함 | 편성현황 전체 테이블 | 0 | 행에는 표시. 요약 평균 포함 여부는 row 종류에 따라 다름 |
