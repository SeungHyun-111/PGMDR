/*
 * 편성일시 기준 직전 실적 조회 Q&A
 *
 * Q. 만들고 싶은 기능은 정확히 무엇인가?
 * A. 실적을 "오늘 기준 최신 1건"으로 고정해서 쓰지 않고, 각 편성 블록의 방송일시를 넘지 않는
 *    가장 최근 실적을 조회하는 기능이다.
 *
 *    예: 오늘이 2026-06-11이고, 2026-06-10에 [히트락]밀폐용기 실적이 있어도
 *    2026-06-08 10:31 편성 블록에서는 2026-06-08 10:31 이하의 실적만 직전 실적으로 본다.
 *    즉 "방송 이후 실적"은 그 방송의 직전 실적에 포함하지 않는다.
 *
 * Q. 모든 곳에서 시점 기준 직전 실적을 써야 하나?
 * A. 아니다. 편성일시가 있는 데이터와 없는 데이터를 구분한다.
 *
 *    1) 사이드바/제안상품처럼 아직 편성표에 들어가지 않은 상품
 *       - 편성일시가 없으므로 cutoff를 만들 수 없다.
 *       - 이 경우에는 "현재 실적DB에서 가장 최신 실적"을 보여준다.
 *
 *    2) 편성표에 들어간 블록, 시뮬레이션, 편성비중, 편성현황, export
 *       - block.dateKey + block.timeText가 있으므로 그 시각을 cutoff로 삼는다.
 *       - cutoff 이하의 가장 최근 실적만 사용한다.
 *
 * Q. 현재 perfMap 구조로는 왜 부족한가?
 * A. 현재 perfMap은 perfKey(거래형태 + 편성코드명)별 최신 1건만 저장한다.
 *    그래서 같은 상품이 여러 날짜에 편성되면 과거 편성에도 미래 실적이 붙을 수 있다.
 *    편성일시 기준 조회를 하려면 최신 1건이 아니라 perfKey별 실적 이력이 필요하다.
 *
 * Q. 세션마다 실적DB를 두지 않고 전역 DB 하나만 읽으면 되는가?
 * A. 기본 방향은 맞다. 실적DB는 주간 편성 세션 상태라기보다 전사 공통 원천 데이터에 가깝다.
 *    따라서 sessions/{weekKey}/gasData/perfMap에 세션별로 복사하기보다,
 *    Firebase 루트에 performanceHistory/latestPerfMap 같은 전역 경로를 둔다.
 *
 *    단, 전역 DB를 쓴다는 말이 "항상 전체 실적을 통째로 읽는다"는 뜻은 아니다.
 *    현재 세션과 화면에서 필요한 perfKey만 골라 읽어야 한다.
 *
 * Q. "필요한 perfKey만 읽는다"를 구체적으로 어떻게 구현하나?
 * A. store에 다음 상태를 둔다.
 *
 *    performanceHistoryByKey: {
 *      [perfKey]: [historyEntry...]
 *    }
 *
 *    latestPerfByKey: {
 *      [perfKey]: latestEntry
 *    }
 *
 *    loadedPerfKeys: {
 *      [perfKey]: { latest: true, history: true, loadedAt }
 *    }
 *
 *    그리고 ensurePerformanceKeys(perfKeys, options) 같은 액션을 둔다.
 *    이 액션은 아직 loadedPerfKeys에 없는 key만 골라 Firebase에서 읽는다.
 *
 *    예:
 *    - 사이드바/미편성 상품 표시용이면 latestPerfMap/{encodedPerfKey}만 읽는다.
 *    - 편성 블록/시뮬레이션용이면 performanceHistory/{encodedPerfKey}를 읽는다.
 *    - 이미 읽은 key는 다시 읽지 않는다. 실적DB 갱신 후에는 loadedPerfKeys를 비우거나 갱신된 key만 무효화한다.
 *
 * Q. 세션 생성 이후 사이드바에 기존에 없던 perfKey 상품이 생기면 어떻게 되나?
 * A. 상품이 추가되거나 수정되는 순간 새 perfKey를 계산하고 ensurePerformanceKeys([perfKey], { latest: true })를 호출한다.
 *    처음에는 실적 칸이 로딩 또는 없음으로 보일 수 있고, Firebase 조회가 끝나면 최신 실적이 채워진다.
 *
 *    이후 그 상품을 편성표에 넣으면 블록 저장/드롭 시점에
 *    ensurePerformanceKeys([perfKey], { history: true })를 추가로 호출한다.
 *    즉 "세션 최초 로딩 때 없던 perfKey"도 상품 추가, 상품 수정, 블록 저장, 제안상품 새로고침 시점에
 *    점진적으로 로드되므로 세션을 다시 만들 필요가 없다.
 *
 * Q. 필요한 perfKey는 언제 수집하나?
 * A. 한 번에 영구 고정하지 않고, 상태 변화에 맞춰 계속 보강한다.
 *
 *    - 세션 최초 로딩: 현재 version의 scheduleBlocks + proposalItems에서 perfKey set을 만든다.
 *      proposalItems는 latest, scheduleBlocks는 history를 우선 로드한다.
 *
 *    - 제안상품 새로고침: 새 proposalItems의 perfKey 중 loadedPerfKeys에 없는 key만 latest 로드한다.
 *
 *    - 사이드바 상품 추가/수정: 해당 상품의 새 perfKey를 latest 로드한다.
 *      상품명/거래형태 변경으로 perfKey가 바뀌면 새 key를 로드하고, 기존 key 캐시는 그냥 남겨둬도 된다.
 *
 *    - 블록 저장/수정/드롭: 해당 block의 perfKey를 history 로드한다.
 *
 *    - 화면 진입: 시뮬레이션/export처럼 편성 블록 전체 실적이 필요한 화면은
 *      현재 scheduleBlocks 기준으로 누락된 history key를 한 번 더 보강한다.
 *
 * Q. 권장 Firebase 저장 구조는?
 * A. 전역 이력은 perfKey별로 묶고, 방송일시로 정렬 가능한 key를 둔다.
 *
 *    performanceHistory/{encodedPerfKey}/{broadcastTimestamp}_{sourceRow} = {
 *      perfKey,
 *      pgmCodeName,
 *      broadcastDate,
 *      broadcastTime,
 *      broadcastTimestamp,
 *      salesPerWeightedMin,
 *      profitPerWeightedMin,
 *      sourceRow
 *    }
 *
 *    latestPerfMap/{encodedPerfKey} = {
 *      perfKey,
 *      pgmCodeName,
 *      broadcastDate,
 *      broadcastTime,
 *      broadcastTimestamp,
 *      salesPerWeightedMin,
 *      profitPerWeightedMin,
 *      sourceRow
 *    }
 *
 *    performanceHistory는 편성 블록 cutoff 조회용이고,
 *    latestPerfMap은 사이드바/미편성 상품처럼 편성일시가 없는 곳의 최신 실적 표시용이다.
 *
 * Q. 성능 면에서 효율적인가?
 * A. "필요한 perfKey만 읽는다"는 전제에서는 효율적이다.
 *    주간 편성에 실제 등장하는 perfKey 수는 전체 실적DB보다 훨씬 작다.
 *    반대로 전역 performanceHistory 전체를 매번 구독하면 비효율적이다.
 *
 *    실시간 구독도 전체 경로에 걸지 않는다.
 *    필요 key별 onValue 또는 1회 get을 쓰고, 실적DB 갱신 버튼을 눌렀을 때 현재 로드된 key만 다시 읽는 쪽이 낫다.
 *
 * Q. 조회 알고리즘은?
 * A. 편성 블록은 cutoff = dateKey + timeText로 만든다.
 *    같은 perfKey의 이력 중 broadcastTimestamp <= cutoff인 후보만 남기고, 가장 큰 timestamp를 고른다.
 *    이력 배열이 시간순으로 정렬되어 있으면 이진 탐색으로 O(log n)에 찾을 수 있다.
 *
 * Q. cutoff와 같은 시각의 실적은 포함하나?
 * A. 포함한다. 사용자가 말한 "6월 8일 10:31 방송까지"가 포함 기준이므로 <= 로 처리한다.
 *    단, 실적DB의 broadcastTime이 방송 시작 시간인지 종료 시간인지 업무적으로 확인해야 한다.
 *
 * Q. 수기 입력(manualInputs), 해당 방송 실적, 직전 실적의 우선순위는?
 * A. "cutoff 이하 실제 실적"을 전부 수기 입력보다 우선하는 것이 아니다.
 *    우선순위가 가장 높은 것은 해당 편성일시에 정확히 매칭되는 방송 실적이다.
 *    그게 없으면 기존처럼 수기 입력이 직전 실적보다 우선한다.
 *
 *    편성 블록 최종 적용 순서:
 *    1) 해당 편성일시와 같은 방송 실적
 *    2) manualInputs[item.uniqueKey]
 *    3) performanceHistory에서 해당 편성일시 이전의 직전 실적
 *    4) 다 없으면 fallback 없이 0
 *
 *    미편성 상품/사이드바 적용 순서:
 *    1) latestPerfMap의 최신 실적
 *    2) 없음이면 0 또는 '-' 표시
 *
 * Q. "해당 편성일시와 같은 방송 실적"과 "직전 실적"은 어떻게 나누나?
 * A. 같은 perfKey의 이력 중 broadcastTimestamp === blockTimestamp인 것은 해당 방송 실적으로 본다.
 *    같은 시각의 실적이 있으면 그 방송이 끝나고 확정 실적이 들어온 상태이므로 수기 입력보다 우선한다.
 *    직전/기준 실적은 broadcastTimestamp < blockTimestamp인 후보 중 가장 최신값이다.
 *    즉 06/10 22:31 편성이면 06/10 22:31 방송 실적은 해당 방송 실적으로 분리하고,
 *    직전 실적에는 그 이전 실적만 포함한다.
 *
 * Q. 수기 입력이 있는데 나중에 해당 방송 실적이 들어오면 어떻게 되나?
 * A. 해당 방송 실적이 표시/계산에 우선 적용된다.
 *    manualInputs 값은 삭제하지 않고 남겨둘 수 있지만, 같은 방송일시 실적이 잡히면 계산에는 쓰지 않는다.
 *    반대로 같은 방송일시 실적이 없고 과거 직전 실적만 있다면 수기 입력이 직전 실적보다 우선한다.
 *    필요하면 UI에서 "수기값 있음, 방송 실적 우선 적용 중" 같은 표시를 둘 수 있다.
 *
 * Q. 기존 perfMap은 바로 없애도 되나?
 * A. 방향상으로는 없애는 쪽이 맞다. 다만 한 번에 삭제하면 영향 범위가 크다.
 *    먼저 조회 유틸을 만들고 화면 코드를 유틸 호출로 바꾼 뒤 perfMap 의존을 제거하는 순서가 안전하다.
 *
 *    이름을 명확히 분리한다.
 *    - latestPerfMap: 편성일시가 없는 상품의 최신 실적
 *    - performanceHistory: 편성일시가 있는 블록의 cutoff 기준 직전 실적
 *
 * Q. 전역 DB를 쓰면 과거 세션 계산값이 바뀌는 경우는 무엇인가?
 * A. 정상적인 케이스는 사용자가 말한 것처럼 "실제로 방송한 실적이 나중에 실적DB에 들어왔을 때"다.
 *    이 경우 과거 세션의 해당 편성 블록 계산값이 바뀌는 것은 허용한다.
 *
 *    그 외에 계산값이 바뀔 수 있는 예외는 다음 정도다.
 *    - 과거 실적DB 값이 정정됨: 취급/분, 한익/분, 날짜, 시간이 수정되는 경우
 *    - 누락된 더 과거 실적이 뒤늦게 추가됨: cutoff 이하의 더 최신 후보가 생기는 경우
 *    - perfKey 정규화 규칙이 바뀜: 거래형태/편성코드명 매칭이 달라지는 경우
 *    - 중복 실적 정리 정책이 바뀜: 같은 방송일시 중 어떤 row를 고를지 달라지는 경우
 *    - GAS 날짜 파싱 버그를 고침: broadcastTimestamp가 달라지는 경우
 *
 *    업무적으로 실적DB가 append-only이고 과거 row 정정이 거의 없다면,
 *    실제로는 "방송 후 실적 입력"이 과거 세션 값을 바꾸는 대부분의 경우가 된다.
 *
 * Q. 실적DB 갱신은 어떻게 바뀌어야 하나?
 * A. "실적DB 갱신" 버튼은 특정 세션의 gasData/perfMap을 갱신하는 대신 전역 DB를 갱신한다.
 *    갱신 후 현재 세션은 loadedPerfKeys에 있는 key만 다시 읽거나, 현재 화면에 필요한 key를 다시 읽는다.
 *
 *    전역 DB 갱신 시 전체 시트를 매번 읽는 것은 단순하지만 데이터가 커지면 느려질 수 있다.
 *    가능하면 마지막 broadcastTimestamp 이후 데이터만 가져오는 증분 갱신을 검토한다.
 *    다만 과거 날짜 실적의 수정/추가가 있다면 전체 재빌드 버튼도 남긴다.
 *
 * Q. 날짜/시간에서 조심할 점은?
 * A. 가장 위험한 지점이다.
 *    실적DB 날짜가 Date 객체, YYYY-MM-DD, M/D 같은 형태로 섞이면 비교가 틀어진다.
 *    GAS 단계에서 반드시 Asia/Seoul 기준 broadcastTimestamp와 YYYY-MM-DD를 만들어 저장해야 한다.
 *    클라이언트는 문자열 파싱을 최소화하고 이미 정규화된 값을 기준으로 비교하는 편이 좋다.
 *
 * Q. 구현 순서는?
 * A. 1) 이 파일에 순수 유틸을 만든다.
 *       - makeBroadcastCutoff(block)
 *       - normalizePerfHistory(raw)
 *       - getLatestPerf(perfKey, latestPerfByKey)
 *       - getPerfForScheduledBlock(perfKey, blockTimestamp, performanceHistoryByKey, manualInput)
 *       - getLastPerfBefore(perfKey, blockTimestamp, performanceHistoryByKey)
 *
 *    2) store에 performanceHistoryByKey, latestPerfByKey, loadedPerfKeys,
 *       ensurePerformanceKeys 액션을 추가한다.
 *
 *    3) GAS buildPerfMap_을 이력 반환이 가능하도록 확장하고 latestPerfMap도 같이 만든다.
 *
 *    4) Firebase 전역 경로를 정하고, 실적DB 갱신 액션이 전역 DB를 쓰도록 바꾼다.
 *
 *    5) 사이드바는 latestPerfMap 기준, 편성 블록/시뮬레이션/export는 cutoff 기준 유틸로 교체한다.
 *
 * Q. 최소 구현으로 먼저 검증하려면?
 * A. 전역 DB로 바로 가지 않고, GAS가 perfKey별 이력 map-array를 반환하게 한 뒤
 *    임시로 세션 gasData/perfHistory에 저장해서 검증할 수 있다.
 *    기능이 맞는지 확인한 다음 performanceHistory 전역 경로로 옮기면 리스크가 낮다.
 *
 * Q. 이 파일의 최종 책임은?
 * A. Firebase 읽기/쓰기, GAS 호출, store 캐시는 다른 파일이 담당한다.
 *    이 파일은 날짜 정규화, cutoff 생성, 이력 정렬, 최신/직전 실적 선택 같은 순수 계산만 담당한다.
 */
