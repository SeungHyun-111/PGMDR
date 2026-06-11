
/**
 * ============================================================
 *  기상청 단기 + 중기 예보 → 구글시트 누적 DB
 * ============================================================
 *  - 단기예보(getVilageFcst)   : 오늘 ~ +3일, 1시간 간격 → 오전/오후로 요약
 *  - 중기육상(getMidLandFcst)  : +3 ~ +10일, 오전/오후 날씨·강수확률
 *  - 중기기온(getMidTa)        : +3 ~ +10일, 최저/최고기온
 *
 *  [누적 방식]
 *   - 날짜(A열)를 키로, 있으면 덮어쓰기 / 없으면 append
 *   - 단기·중기가 겹치는 +3일 구간은 "단기 우선" (단기를 나중에 써서 덮음)
 *   - 과거 날짜 행은 손대지 않음 → 마지막 받은 값 그대로 박제 누적
 *
 *  [실행 전 준비]
 *   1) 시트에 'forecast' 탭이 자동 생성됨 (없으면)
 *   2) 스크립트 속성에 KMA_SERVICE_KEY = (디코딩키 원본) 저장
 *      프로젝트 설정 → 스크립트 속성 → 속성 추가
 *   3) 트리거: updateWeather 함수를 원하는 시각(예: 하루 3회)에 시간기반 트리거로 등록
 * ============================================================
 */


/* ===========================================================
 *  W_CONFIG : 설정값은 전부 여기서 관리 (하드코딩 최소화)
 * =========================================================== */
const W_CONFIG = {
  // 인증키 (공공데이터포털 디코딩키 원본).
  // ※ 코드에 직접 박는 방식. 깃/공유 시 노출 주의.
  SERVICE_KEY: 'ngx/BFtjRyWWjj+yPeRTo2TrinX/wrFwkYpu1ROLrnac5ZLI+ckoMTL1wptN0WfsHSUTLmOgwz1UiLEHd8FVAw==',

  // 결과를 쓸 시트 탭 이름
  SHEET_NAME: 'forecast',

  // 지역 설정 -----------------------------------------------
  // 단기예보: 격자좌표 (동 단위). 상암동 기준.
  SHORT_TERM: { nx: 58, ny: 126 },
  // 중기예보: 지역코드 (광역 단위). 육상/기온 코드 체계가 다름.
  MID_TERM: {
    landRegId: '11B00000', // 중기육상 - 서울·경기
    taRegId:   '11B10101'  // 중기기온 - 서울
  },

  // API 엔드포인트 ------------------------------------------
  URL: {
    vilage:   'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
    midLand:  'http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst',
    midTa:    'http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa'
  },

  // 시트 컬럼 순서 (헤더와 데이터 매핑의 단일 기준) ---------
  COLUMNS: [
    '날짜', '요일', '출처',
    '최저기온', '최고기온',
    '오전_날씨', '오후_날씨',
    '오전_강수확률', '오후_강수확률',
    '오전_이모지', '오후_이모지',
    '습도', '강수량',
    '갱신시각'
  ],

  TIMEZONE: 'Asia/Seoul',

  // true면 W_callApi가 요청URL(키 마스킹)·응답상태를 로그로 출력
  DEBUG: true
};


/* ===========================================================
 *  매핑 테이블 : 날씨 텍스트 ↔ 이모지
 * =========================================================== */

// 중기예보 날씨 텍스트(wf) → 이모지
// 기상청 중기 wf 값은 "맑음/구름많음/흐림/흐리고 비/소나기" 등 텍스트로 옴
const W_MID_WF_EMOJI = [
  { match: ['흐리고 비', '흐리고 눈', '흐리고 비/눈'], emoji: '🌧️' },
  { match: ['구름많고 비', '구름많고 눈', '구름많고 소나기'], emoji: '🌦️' },
  { match: ['소나기'], emoji: '🌦️' },
  { match: ['비'], emoji: '🌧️' },
  { match: ['눈'], emoji: '🌨️' },
  { match: ['흐림'], emoji: '☁️' },
  { match: ['구름많음'], emoji: '⛅' },
  { match: ['맑음'], emoji: '☀️' }
];

// 단기예보 SKY(하늘) + PTY(강수형태) → {텍스트, 이모지}
// SKY: 1맑음 3구름많음 4흐림 / PTY: 0없음 1비 2비눈 3눈 4소나기
function W_skyPtyToWeather(sky, pty) {
  sky = String(sky);
  pty = String(pty);

  // 강수가 있으면 강수형태 우선
  if (pty === '1') return { text: '비',        emoji: '🌧️' };
  if (pty === '2') return { text: '비/눈',     emoji: '🌨️' };
  if (pty === '3') return { text: '눈',        emoji: '🌨️' };
  if (pty === '4') return { text: '소나기',    emoji: '🌦️' };

  // 강수 없으면 하늘상태
  if (sky === '1') return { text: '맑음',      emoji: '☀️' };
  if (sky === '3') return { text: '구름많음',  emoji: '⛅' };
  if (sky === '4') return { text: '흐림',      emoji: '☁️' };

  return { text: '-', emoji: '' };
}

// 중기 날씨 텍스트 → 이모지 변환
function W_midWfToEmoji(wf) {
  if (!wf) return '';
  for (const rule of W_MID_WF_EMOJI) {
    if (rule.match.some(m => wf.indexOf(m) !== -1)) return rule.emoji;
  }
  return '';
}


/* ===========================================================
 *  메인 : 트리거가 호출하는 진입점
 * =========================================================== */
function updateWeather() {
  const t0 = new Date();
  Logger.log('================ updateWeather 시작 ================');
  Logger.log('실행시각(KST): ' + W_nowStr());

  // ---- STEP 0 : 키 확인 ----
  const key = W_CONFIG.SERVICE_KEY;
  if (!key) {
    Logger.log('❌ STEP0 실패: W_CONFIG.SERVICE_KEY 가 비어있습니다.');
    throw new Error('SERVICE_KEY 없음');
  }
  Logger.log('STEP0 ✅ 키 확인 (길이=' + key.length + ', 앞6자=' + key.slice(0, 6)
             + (key.indexOf('%') !== -1 ? ' / ⚠️%포함=인코딩키의심' : ' / 디코딩키로보임') + ')');

  const today = new Date();
  const rowMap = {};

  // ---- STEP 1 : 발표시각 계산 ----
  const vBase = W_getVilageBaseDateTime(today);
  const mFc = W_getMidTmFc(today);
  Logger.log('STEP1 ✅ 발표시각  단기 base=' + vBase.date + ' ' + vBase.time
             + ' / 중기 tmFc=' + mFc);

  // ---- STEP 2 : 중기 육상예보 ----
  let land;
  try {
    land = W_fetchMidLand(key, today);
    Logger.log('STEP2 ✅ 중기육상 수신  wf3Am=' + W_valOr(land.wf3Am, '(없음)')
               + ' / rnSt3Am=' + W_valOr(land.rnSt3Am, '(없음)'));
  } catch (e) {
    Logger.log('STEP2 ❌ 중기육상 실패: ' + e.message);
    throw e;
  }

  // ---- STEP 3 : 중기 기온예보 ----
  let ta;
  try {
    ta = W_fetchMidTa(key, today);
    Logger.log('STEP3 ✅ 중기기온 수신  taMin3=' + W_valOr(ta.taMin3, '(없음)')
               + ' / taMax3=' + W_valOr(ta.taMax3, '(없음)'));
  } catch (e) {
    Logger.log('STEP3 ❌ 중기기온 실패: ' + e.message);
    throw e;
  }

  // ---- STEP 4 : 중기 병합 ----
  W_mergeMid(rowMap, land, ta, today);
  Logger.log('STEP4 ✅ 중기 병합 완료  누적 날짜수=' + Object.keys(rowMap).length);

  // ---- STEP 5 : 단기예보 ----
  let vil;
  try {
    vil = W_fetchVilage(key, today);
    Logger.log('STEP5 ✅ 단기 수신  날짜수=' + Object.keys(vil).length
               + ' → ' + Object.keys(vil).map(W_ymdToKey).sort().join(', '));
  } catch (e) {
    Logger.log('STEP5 ❌ 단기 실패: ' + e.message);
    throw e;
  }

  // ---- STEP 6 : 단기 병합 (겹침구간 덮어쓰기) ----
  W_mergeShort(rowMap, vil, today);
  Logger.log('STEP6 ✅ 단기 병합 완료  최종 날짜수=' + Object.keys(rowMap).length);

  // 병합 결과 표로 출력
  Logger.log('---- 최종 데이터 (시트 기록 예정) ----');
  Object.keys(rowMap).sort().forEach(d => {
    const r = rowMap[d];
    Logger.log(
      r.날짜 + ' ' + r.요일 + ' [' + r.출처 + ']'
      + ' 최저' + W_pad(r.최저기온, 3) + ' 최고' + W_pad(r.최고기온, 3)
      + ' | 오전 ' + r.오전_이모지 + W_pad(r.오전_날씨, 8) + W_pad(r.오전_강수확률, 3) + '%'
      + ' | 오후 ' + r.오후_이모지 + W_pad(r.오후_날씨, 8) + W_pad(r.오후_강수확률, 3) + '%'
    );
  });

  // 겹침 검증
  const overlap = W_addDaysKey(today, 3);
  if (rowMap[overlap]) {
    Logger.log('[겹침검증] +3일(' + overlap + ') 출처=' + rowMap[overlap].출처 + ' (단기여야 정상)');
  }

  // ---- STEP 7 : 시트 기록 ----
  try {
    const res = W_writeToSheet(rowMap);
    Logger.log('STEP7 ✅ 시트 기록 완료  덮어쓰기=' + res.updated + '행, 신규=' + res.appended + '행');
  } catch (e) {
    Logger.log('STEP7 ❌ 시트 기록 실패: ' + e.message);
    throw e;
  }

  const sec = ((new Date() - t0) / 1000).toFixed(1);
  Logger.log('================ 완료 (' + sec + '초) ================');
}


/* ===========================================================
 *  단기예보 호출 + 파싱
 * =========================================================== */
function W_fetchVilage(key, today) {
  const base = W_getVilageBaseDateTime(today);

  const params = {
    serviceKey: key,           // 아래에서 encodeURIComponent 처리
    pageNo: 1,
    numOfRows: 1000,           // 하루 12개항목 × 시각 × 4일 → 넉넉히
    dataType: 'JSON',
    base_date: base.date,
    base_time: base.time,
    nx: W_CONFIG.SHORT_TERM.nx,
    ny: W_CONFIG.SHORT_TERM.ny
  };

  const items = W_callApi(W_CONFIG.URL.vilage, params);

  // items를 날짜별·시각별로 재구성
  // byDate: { 'YYYYMMDD': { 'HHMM': {TMP, SKY, PTY, POP, PCP, REH}, _TMN, _TMX } }
  const byDate = {};
  items.forEach(it => {
    const d = it.fcstDate, t = it.fcstTime, c = it.category, v = it.fcstValue;
    if (!byDate[d]) byDate[d] = { times: {}, TMN: null, TMX: null };
    if (c === 'TMN') byDate[d].TMN = v;
    else if (c === 'TMX') byDate[d].TMX = v;
    else {
      if (!byDate[d].times[t]) byDate[d].times[t] = {};
      byDate[d].times[t][c] = v;
    }
  });

  return byDate;
}

// 단기예보 발표시각 자동계산: 02 05 08 11 14 17 20 23시 중 가장 최근 회차
// (발표 후 약 10분 뒤 제공되므로 안전하게 처리)
function W_getVilageBaseDateTime(now) {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  const tz = W_CONFIG.TIMEZONE;
  let d = new Date(now.getTime());
  let hour = Number(Utilities.formatDate(d, tz, 'H'));
  let min  = Number(Utilities.formatDate(d, tz, 'm'));

  // 발표 직후 데이터 지연 감안: 발표시각+10분이 안 지났으면 이전 회차 사용
  let picked = null;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (hour > slots[i] || (hour === slots[i] && min >= 10)) { picked = slots[i]; break; }
  }
  // 새벽 02:10 이전이면 전날 23시 회차
  if (picked === null) {
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    picked = 23;
  }

  return {
    date: Utilities.formatDate(d, tz, 'yyyyMMdd'),
    time: ('0' + picked).slice(-2) + '00'
  };
}

// 단기 데이터를 rowMap에 병합 (오전/오후 요약)
// - 단기 끄트머리 날짜(시각데이터 없음)는 중기값을 덮지 않도록 가드
// - 최저/최고가 빈값이면 기존(중기 또는 이전 회차)값을 보존
function W_mergeShort(rowMap, byDate, today) {
  Object.keys(byDate).forEach(ymd => {
    const dateKey = W_ymdToKey(ymd);            // YYYY-MM-DD
    const day = byDate[ymd];

    // 오전(0600~1100) / 오후(1200~1800) 구간 대표값 산출
    const am = W_summarizeBlock(day.times, 600, 1100);
    const pm = W_summarizeBlock(day.times, 1200, 1800);

    // 이 단기 데이터가 사실상 비어있는지 판정:
    // 오전·오후 둘 다 날씨가 '-'면 시각 데이터가 없는 끄트머리 날짜.
    const isEmptyShort = (am.text === '-' && pm.text === '-');

    // 비어있으면 → 중기값이 이미 있으면 그대로 두고 건너뜀(덮지 않음).
    //              중기값도 없으면(드문 경우) 굳이 빈 단기로 채우지 않음.
    if (isEmptyShort) {
      return; // 이 날짜는 단기로 덮어쓰지 않음 → 6/15 같은 경계일 중기값 보존
    }

    // 기존 행(중기로 깔린 값 등) 참조 — 최저/최고 보존에 사용
    const prev = rowMap[dateKey] || {};

    // 최저/최고: 단기에 값이 있으면 사용, 없으면 기존값 보존(빈값으로 덮지 않음)
    const tmn = (day.TMN !== null && day.TMN !== undefined && day.TMN !== '')
      ? day.TMN : W_valOr(prev.최저기온);
    const tmx = (day.TMX !== null && day.TMX !== undefined && day.TMX !== '')
      ? day.TMX : W_valOr(prev.최고기온);

    rowMap[dateKey] = {
      날짜: dateKey,
      요일: W_weekday(dateKey),
      출처: '단기',
      최저기온: tmn,
      최고기온: tmx,
      오전_날씨: am.text,
      오후_날씨: pm.text,
      오전_강수확률: am.pop,
      오후_강수확률: pm.pop,
      오전_이모지: am.emoji,
      오후_이모지: pm.emoji,
      습도: pm.reh !== '' ? pm.reh : am.reh,   // 대표 1개 (오후 우선)
      강수량: pm.pcp !== '' ? pm.pcp : am.pcp,
      갱신시각: W_nowStr()
    };
  });
}

// 한 구간(시작~끝 시각)의 대표값 계산
function W_summarizeBlock(times, fromHHMM, toHHMM) {
  const keys = Object.keys(times).filter(t => {
    const n = Number(t);
    return n >= fromHHMM && n <= toHHMM;
  }).sort();

  if (keys.length === 0) {
    return { text: '-', emoji: '', pop: '', reh: '', pcp: '' };
  }

  // 대표 하늘상태: 구간 중간 시각 사용 (없으면 첫 값)
  const mid = keys[Math.floor(keys.length / 2)];
  const w = W_skyPtyToWeather(times[mid].SKY, times[mid].PTY);

  // 강수확률: 구간 최댓값 (소나기 누락 방지)
  let maxPop = 0;
  keys.forEach(t => { maxPop = Math.max(maxPop, Number(times[t].POP || 0)); });

  // 습도: 구간 평균
  let rehSum = 0, rehCnt = 0;
  keys.forEach(t => {
    if (times[t].REH != null && times[t].REH !== '') { rehSum += Number(times[t].REH); rehCnt++; }
  });
  const reh = rehCnt ? Math.round(rehSum / rehCnt) : '';

  // 강수량: 구간 합 (PCP는 '강수없음' 등 문자열 주의 → 숫자만 추출)
  let pcpSum = 0, hasPcp = false;
  keys.forEach(t => {
    const num = W_parsePcp(times[t].PCP);
    if (num > 0) { pcpSum += num; hasPcp = true; }
  });
  const pcp = hasPcp ? Math.round(pcpSum * 10) / 10 : 0;

  return { text: w.text, emoji: w.emoji, pop: maxPop, reh: reh, pcp: pcp };
}

// PCP/SNO 문자열 → 숫자 ('강수없음','1.0mm 미만' 등 처리)
function W_parsePcp(v) {
  if (v == null || v === '' || v === '강수없음') return 0;
  if (String(v).indexOf('미만') !== -1) return 0.5; // '1.0mm 미만' 류는 소량으로 간주
  const m = String(v).match(/[\d.]+/);
  return m ? Number(m[0]) : 0;
}


/* ===========================================================
 *  중기 육상예보 호출 + 파싱
 * =========================================================== */
function W_fetchMidLand(key, today) {
  const params = {
    serviceKey: key,
    pageNo: 1,
    numOfRows: 10,
    dataType: 'JSON',
    regId: W_CONFIG.MID_TERM.landRegId,
    tmFc: W_getMidTmFc(today)
  };
  const items = W_callApi(W_CONFIG.URL.midLand, params);
  return items.length ? items[0] : {};   // 한 row에 모든 날짜 컬럼이 들어있음
}

// 중기 기온예보 호출 + 파싱
function W_fetchMidTa(key, today) {
  const params = {
    serviceKey: key,
    pageNo: 1,
    numOfRows: 10,
    dataType: 'JSON',
    regId: W_CONFIG.MID_TERM.taRegId,
    tmFc: W_getMidTmFc(today)
  };
  const items = W_callApi(W_CONFIG.URL.midTa, params);
  return items.length ? items[0] : {};
}

// 중기예보 발표시각(tmFc): 06시 / 18시 중 최근 회차 → yyyyMMddHHmm
function W_getMidTmFc(now) {
  const tz = W_CONFIG.TIMEZONE;
  let d = new Date(now.getTime());
  let hour = Number(Utilities.formatDate(d, tz, 'H'));

  let slot;
  if (hour >= 18) slot = 18;
  else if (hour >= 6) slot = 6;
  else {  // 06시 이전 → 전날 18시
    d = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    slot = 18;
  }
  return Utilities.formatDate(d, tz, 'yyyyMMdd') + ('0' + slot).slice(-2) + '00';
}

// 중기 데이터를 rowMap에 병합 (+3 ~ +10일)
function W_mergeMid(rowMap, land, ta, today) {
  // n일째(3~10)를 날짜로 환산해서 채움
  for (let n = 3; n <= 10; n++) {
    const dateKey = W_addDaysKey(today, n);

    // 날씨·강수확률: 8일째부터는 오전/오후 구분 없음
    let wfAm, wfPm, popAm, popPm;
    if (n <= 7) {
      wfAm = land['wf' + n + 'Am'];   wfPm = land['wf' + n + 'Pm'];
      popAm = land['rnSt' + n + 'Am']; popPm = land['rnSt' + n + 'Pm'];
    } else {
      // 8~10일째: 단일값을 오전/오후 양쪽에 복제
      wfAm = wfPm = land['wf' + n];
      popAm = popPm = land['rnSt' + n];
    }

    rowMap[dateKey] = {
      날짜: dateKey,
      요일: W_weekday(dateKey),
      출처: '중기',
      최저기온: W_valOr(ta['taMin' + n]),
      최고기온: W_valOr(ta['taMax' + n]),
      오전_날씨: W_valOr(wfAm, '-'),
      오후_날씨: W_valOr(wfPm, '-'),
      오전_강수확률: W_valOr(popAm),
      오후_강수확률: W_valOr(popPm),
      오전_이모지: W_midWfToEmoji(wfAm),
      오후_이모지: W_midWfToEmoji(wfPm),
      습도: '',      // 중기엔 없음
      강수량: '',    // 중기엔 없음
      갱신시각: W_nowStr()
    };
  }
}


/* ===========================================================
 *  공통 : API 호출 (인증키 인코딩 + 에러 처리)
 * =========================================================== */
function W_callApi(url, params) {
  // serviceKey는 디코딩키이므로 직접 encodeURIComponent.
  // 나머지 파라미터도 안전하게 인코딩하여 쿼리스트링 구성.
  const qs = Object.keys(params).map(k => {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');

  const full = url + '?' + qs;

  // 디버그: 요청 URL에서 serviceKey 값만 가려서 출력
  if (W_CONFIG.DEBUG) {
    const masked = full.replace(/serviceKey=[^&]+/, 'serviceKey=***MASKED***');
    Logger.log('[요청] ' + masked);
  }

  const res = UrlFetchApp.fetch(full, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  const body = res.getContentText();

  if (W_CONFIG.DEBUG) {
    Logger.log('[응답] HTTP ' + code + ' / 본문앞 120자: ' + body.slice(0, 120));
  }

  if (code !== 200) {
    throw new Error('HTTP ' + code + ' / ' + body.slice(0, 300));
  }

  // 인증 실패 등은 200으로 오면서 본문에 에러가 담기는 경우가 많음
  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    throw new Error('JSON 파싱 실패 (인증키/요청 확인): ' + body.slice(0, 300));
  }

  const header = json.response && json.response.header;
  if (!header || header.resultCode !== '00') {
    throw new Error('API 오류: ' + (header ? header.resultMsg : body.slice(0, 300)));
  }

  const itemsNode = json.response.body.items;
  if (!itemsNode || !itemsNode.item) return [];
  return Array.isArray(itemsNode.item) ? itemsNode.item : [itemsNode.item];
}


/* ===========================================================
 *  시트 쓰기 : 날짜(A열) 매치 → 있으면 덮어쓰기 / 없으면 append
 *  - 전체를 한 번에 읽고(메모리), 한 번에 쓰는 batch 방식 (속도)
 *  - 새 값이 빈칸인 셀은 기존 셀 값을 보존 (오늘 최저기온 등)
 * =========================================================== */
function W_writeToSheet(rowMap) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(W_CONFIG.SHEET_NAME);

  // 시트 없으면 생성 + 헤더
  if (!sheet) {
    sheet = ss.insertSheet(W_CONFIG.SHEET_NAME);
    sheet.appendRow(W_CONFIG.COLUMNS);
    sheet.setFrozenRows(1);
  }

  const nCols = W_CONFIG.COLUMNS.length;
  const lastRow = sheet.getLastRow();

  // 기존 데이터 전체를 한 번에 읽음 (헤더 제외)
  const existing = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, nCols).getValues()
    : [];

  // 날짜(A열) → 기존행 인덱스(existing 배열 내 위치)
  // ※ 시트가 날짜를 Date형으로 자동변환해 저장하므로, 읽을 때 yyyy-MM-dd 문자열로 정규화해 매칭
  const dateToIdx = {};
  existing.forEach((row, i) => { dateToIdx[W_normDate(row[0])] = i; });

  // "빈값이면 기존값 보존" 헬퍼
  const isBlank = v => (v === '' || v === null || v === undefined);

  const dates = Object.keys(rowMap).sort();
  let updated = 0;
  const appendRows = [];

  dates.forEach(dateKey => {
    const newArr = W_CONFIG.COLUMNS.map(col => rowMap[dateKey][col]);

    if (dateToIdx[dateKey] !== undefined) {
      // 기존 행 덮어쓰기 (단, 새 값이 빈칸이면 기존 값 유지)
      const oldArr = existing[dateToIdx[dateKey]];
      const merged = newArr.map((v, c) => isBlank(v) ? oldArr[c] : v);
      existing[dateToIdx[dateKey]] = merged; // 메모리에서만 갱신
      updated++;
    } else {
      appendRows.push(newArr);
    }
  });

  // 1) 덮어쓰기: 기존 영역 전체를 한 번에 다시 씀
  if (existing.length) {
    sheet.getRange(2, 1, existing.length, nCols).setValues(existing);
  }

  // 2) 신규: 한 번에 append
  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, nCols)
         .setValues(appendRows);
  }

  return { updated: updated, appended: appendRows.length };
}


/* ===========================================================
 *  유틸 : 날짜·요일·포맷
 * =========================================================== */

// 시트에서 읽은 A열 값(Date 또는 문자열)을 'yyyy-MM-dd' 문자열로 정규화
// - 시트는 '2026-06-11' 문자열을 자동으로 Date형으로 저장하므로, 읽을 땐 Date가 옴
function W_normDate(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, W_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  // 'YYYY-MM-DD ...' 형태면 앞 10자만, 'YYYY-M-D' 등도 대비해 분해
  const m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  return s;
}

// 'YYYYMMDD' → 'YYYY-MM-DD'
function W_ymdToKey(ymd) {
  return ymd.slice(0, 4) + '-' + ymd.slice(4, 6) + '-' + ymd.slice(6, 8);
}

// today + n일 → 'YYYY-MM-DD'
function W_addDaysKey(today, n) {
  const d = new Date(today.getTime() + n * 24 * 60 * 60 * 1000);
  return Utilities.formatDate(d, W_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

// 'YYYY-MM-DD' → 요일 한글 (KST 기준)
function W_weekday(dateKey) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  // 정오로 고정해 타임존 경계 밀림 방지 후, KST 기준 요일(u: 1=월~7=일) 사용
  const d = new Date(dateKey + 'T12:00:00+09:00');
  const u = Number(Utilities.formatDate(d, W_CONFIG.TIMEZONE, 'u')); // 1=월 ... 7=일
  return days[u % 7]; // 7(일)→0, 1(월)→1 ... 6(토)→6
}

// 현재 시각 문자열
function W_nowStr() {
  return Utilities.formatDate(new Date(), W_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
}

// 값이 없으면 기본값
function W_valOr(v, def) {
  if (v === undefined || v === null || v === '') return (def !== undefined ? def : '');
  return v;
}


/* ===========================================================
 *  보조 : 수동 테스트용
 * ===========================================================
 *  [테스트 순서 권장]
 *   0) test0_key       : 스크립트 속성에 키가 들어있는지
 *   1) test1_baseTime  : 발표시각 계산이 맞는지 (API 호출 없음)
 *   2) test2_short     : 단기 호출 + 오전/오후 요약 결과
 *   3) test3_mid       : 중기 육상/기온 호출 + 날짜 매핑
 *   4) test4_merge     : 단기+중기 병합된 최종 rowMap 전체
 *   5) test5_dryRun    : 시트에 쓰기 직전까지 (실제 기록 안 함)
 *   6) updateWeather   : 실제 시트 기록까지 (운영)
 * =========================================================== */

// 구분선 로그 헬퍼
function W_line(title) {
  Logger.log('\n========== ' + title + ' ==========');
}

// 0) 키 존재 확인 (값 전체는 보안상 앞 6자리만)
function test0_key() {
  W_line('STEP0  키 확인');
  const key = W_CONFIG.SERVICE_KEY;
  if (!key) {
    Logger.log('❌ KMA_SERVICE_KEY 없음 → 프로젝트 설정 > 스크립트 속성에 디코딩키 추가하세요.');
    return;
  }
  Logger.log('✅ 키 있음. 길이=' + key.length + ', 앞 6자=' + key.slice(0, 6) + '...');
  // 디코딩키인지 인코딩키인지 추정 (인코딩키는 %가 들어있음)
  if (key.indexOf('%') !== -1) {
    Logger.log('⚠️ 키에 % 포함 → 인코딩키일 가능성. 코드가 다시 인코딩하면 이중인코딩 오류 발생.');
    Logger.log('   디코딩키(원본, + / = 포함)를 넣는 것을 권장합니다.');
  } else {
    Logger.log('   % 없음 → 디코딩키로 보임 (정상).');
  }
}

// 1) 발표시각 계산만 확인 (API 호출 없음)
function test1_baseTime() {
  W_line('STEP1  발표시각 계산');
  const today = new Date();
  Logger.log('현재(KST): ' + W_nowStr());
  Logger.log('단기 base : ' + JSON.stringify(W_getVilageBaseDateTime(today)));
  Logger.log('중기 tmFc : ' + W_getMidTmFc(today));
}

// 2) 단기 호출 + 요약 결과 상세
function test2_short() {
  W_line('STEP2  단기예보');
  const key = W_CONFIG.SERVICE_KEY;
  const today = new Date();

  const base = W_getVilageBaseDateTime(today);
  Logger.log('요청 base_date/time = ' + base.date + ' ' + base.time
             + ' / nx,ny = ' + W_CONFIG.SHORT_TERM.nx + ',' + W_CONFIG.SHORT_TERM.ny);

  const byDate = W_fetchVilage(key, today);
  const dates = Object.keys(byDate).sort();
  Logger.log('응답 날짜수: ' + dates.length + ' → ' + dates.join(', '));

  // 날짜별 오전/오후 요약을 표처럼 출력
  dates.forEach(ymd => {
    const day = byDate[ymd];
    const am = W_summarizeBlock(day.times, 600, 1100);
    const pm = W_summarizeBlock(day.times, 1200, 1800);
    Logger.log(
      W_ymdToKey(ymd)
      + ' | 최저' + (day.TMN !== null ? day.TMN : '-')
      + ' 최고' + (day.TMX !== null ? day.TMX : '-')
      + ' | 오전 ' + am.emoji + am.text + '(' + am.pop + '%)'
      + ' 오후 ' + pm.emoji + pm.text + '(' + pm.pop + '%)'
      + ' | 습도' + pm.reh + ' 강수' + pm.pcp
    );
  });
}

// 3) 중기 호출 + 날짜 매핑 상세
function test3_mid() {
  W_line('STEP3  중기예보');
  const key = W_CONFIG.SERVICE_KEY;
  const today = new Date();

  const land = W_fetchMidLand(key, today);
  const ta = W_fetchMidTa(key, today);

  if (!land.wf3Am && !land.wf3) {
    Logger.log('⚠️ 중기육상 응답이 비어있음. regId/tmFc 확인 필요.');
  }
  if (!ta.taMin3) {
    Logger.log('⚠️ 중기기온 응답이 비어있음. regId(기온코드) 확인 필요.');
  }

  for (let n = 3; n <= 10; n++) {
    const dateKey = W_addDaysKey(today, n);
    let wfAm, wfPm, popAm, popPm;
    if (n <= 7) {
      wfAm = land['wf' + n + 'Am']; wfPm = land['wf' + n + 'Pm'];
      popAm = land['rnSt' + n + 'Am']; popPm = land['rnSt' + n + 'Pm'];
    } else {
      wfAm = wfPm = land['wf' + n];
      popAm = popPm = land['rnSt' + n];
    }
    Logger.log(
      '+' + n + '일 ' + dateKey
      + ' | 최저' + W_valOr(ta['taMin' + n], '-') + ' 최고' + W_valOr(ta['taMax' + n], '-')
      + ' | 오전 ' + W_midWfToEmoji(wfAm) + W_valOr(wfAm, '-') + '(' + W_valOr(popAm, '-') + '%)'
      + ' 오후 ' + W_midWfToEmoji(wfPm) + W_valOr(wfPm, '-') + '(' + W_valOr(popPm, '-') + '%)'
    );
  }
}

// 4) 병합된 최종 rowMap 전체를 표처럼 출력
function test4_merge() {
  W_line('STEP4  병합 결과 (최종 시트에 들어갈 값)');
  const key = W_CONFIG.SERVICE_KEY;
  const today = new Date();

  const rowMap = {};
  W_mergeMid(rowMap, W_fetchMidLand(key, today), W_fetchMidTa(key, today), today);
  W_mergeShort(rowMap, W_fetchVilage(key, today), today);

  const dates = Object.keys(rowMap).sort();
  Logger.log('총 ' + dates.length + '일치\n');
  Logger.log('날짜       요일 출처 최저 최고 오전        오후        습도 강수');
  dates.forEach(d => {
    const r = rowMap[d];
    Logger.log(
      r.날짜 + ' ' + r.요일 + '  ' + r.출처
      + '  ' + W_pad(r.최저기온, 3) + ' ' + W_pad(r.최고기온, 3)
      + '  ' + W_pad(r.오전_이모지 + r.오전_날씨, 9)
      + ' ' + W_pad(r.오후_이모지 + r.오후_날씨, 9)
      + '  ' + W_pad(r.습도, 3) + ' ' + W_pad(r.강수량, 4)
    );
  });

  // 겹침 구간(+3일) 단기 우선 적용 확인
  const overlap = W_addDaysKey(today, 3);
  if (rowMap[overlap]) {
    Logger.log('\n[겹침검증] +3일(' + overlap + ') 출처 = '
               + rowMap[overlap].출처 + ' (단기여야 정상)');
  }
}

// 5) 시트 쓰기 직전까지 점검 (실제 기록은 안 함)
function test5_dryRun() {
  W_line('STEP5  시트 쓰기 시뮬레이션 (실제 기록 안 함)');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(W_CONFIG.SHEET_NAME);

  if (!sheet) {
    Logger.log('시트 "' + W_CONFIG.SHEET_NAME + '" 없음 → 최초 실행 시 자동 생성됩니다.');
    return;
  }
  const lastRow = sheet.getLastRow();
  const existing = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]))
    : [];
  Logger.log('기존 시트 행수(헤더 제외): ' + existing.length);
  Logger.log('기존 마지막 날짜: ' + (existing.length ? existing[existing.length - 1] : '없음'));

  const key = W_CONFIG.SERVICE_KEY;
  const today = new Date();
  const rowMap = {};
  W_mergeMid(rowMap, W_fetchMidLand(key, today), W_fetchMidTa(key, today), today);
  W_mergeShort(rowMap, W_fetchVilage(key, today), today);

  const dates = Object.keys(rowMap).sort();
  let willUpdate = 0, willAppend = 0;
  dates.forEach(d => {
    if (existing.indexOf(d) !== -1) willUpdate++; else willAppend++;
  });
  Logger.log('이번 실행 시 → 덮어쓰기 ' + willUpdate + '행, 신규추가 ' + willAppend + '행');
  Logger.log('(실제 기록은 updateWeather 실행 시 수행)');
}

// 전체 한 번에: 0~5단계 순차 실행
function testAll() {
  test0_key();
  test1_baseTime();
  test2_short();
  test3_mid();
  test4_merge();
  test5_dryRun();
  W_line('완료. 위 로그가 정상이면 updateWeather에 트리거를 거세요.');
}

// 로그 정렬용 패딩 헬퍼
function W_pad(v, n) {
  let s = String(v == null ? '' : v);
  while (s.length < n) s += ' ';
  return s;
}


/* ===========================================================
 *  일회용 : 중복 행 청소
 * ===========================================================
 *  매칭 버그로 같은 날짜가 여러 번 쌓였을 때 정리.
 *  같은 날짜는 "마지막(가장 아래) 행"만 남기고 위쪽 중복을 제거.
 *  실행 후에는 안 써도 됨.
 * =========================================================== */
function cleanupDuplicateDates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(W_CONFIG.SHEET_NAME);
  if (!sheet) { Logger.log('시트 없음'); return; }

  const nCols = W_CONFIG.COLUMNS.length;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) { Logger.log('정리할 데이터 없음'); return; }

  const data = sheet.getRange(2, 1, lastRow - 1, nCols).getValues();

  // 날짜 → 마지막으로 본 행(같은 날짜면 뒤엣것이 덮음)
  const byDate = {};
  data.forEach(row => { byDate[W_normDate(row[0])] = row; });

  // 날짜 오름차순 정렬해 재구성
  const cleaned = Object.keys(byDate).sort().map(d => byDate[d]);

  Logger.log('정리 전 ' + data.length + '행 → 정리 후 ' + cleaned.length + '행');

  // 기존 데이터 영역 비우고 다시 씀
  sheet.getRange(2, 1, data.length, nCols).clearContent();
  sheet.getRange(2, 1, cleaned.length, nCols).setValues(cleaned);

  Logger.log('✅ 중복 정리 완료');
}