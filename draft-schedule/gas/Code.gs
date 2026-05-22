/************************************
 * 초안 편성 작업판 Code.gs
 ************************************/

const DRAFT_CONFIG = {
  PROPOSAL_SPREADSHEET_ID:        '1xjAapb73WtIxGKbfNJhbaXpafMoSmBpABq_d_SquD1M',
  PGM_SPREADSHEET_ID:             '1t7LjC8g4uXBuubaspi38dquPmCGbY8vcsSXcKgWHvhg',
  PRE_SCHEDULE_SPREADSHEET_ID:    '18eXyF5gWc2NynyA9OJmR6XuK-BKJeopb0GxmXdLLlGU',
  TARGET_SPREADSHEET_ID:          '1e9rjwdzMgnCeBG3uvRdTidTtp00UrIASJ-qia9k1dlc',
  WEIGHTED_TARGET_SPREADSHEET_ID: '13D5TrPbu_8kcd2yuR9W9tSFQO5U0avYXvY3OLdfJG7I',

  PROPOSAL_SHEETS: { A: 'A_Pool', B: 'B_Pool' },

  PGM_SHEET_NAME:             'PGM',
  PERFORMANCE_SHEET_NAME:     '실적DB',
  PRE_SCHEDULE_SHEET_NAME:    '종합',
  TARGET_SALES_SHEET_NAME:    '분취',
  TARGET_PROFIT_SHEET_NAME:   '분당한계이익',
  WEIGHTED_TARGET_SHEET_NAME: '시트2',

  TIMEZONE: 'Asia/Seoul'
};

/************************************
 * 컬럼 사전
 ************************************/
const PROPOSAL_COLUMNS = [
  { index: 0,  key: 'mdTeam',                name: 'MD팀' },
  { index: 1,  key: 'mdCategory',            name: 'MD분류' },
  { index: 2,  key: 'mdName',                name: 'MD명' },
  { index: 3,  key: 'pgmCode',               name: '편성코드' },
  { index: 4,  key: 'pgmCodeName',           name: '편성코드명' },
  { index: 5,  key: 'videoCode',             name: '영상코드' },
  { index: 6,  key: 'videoName',             name: '영상명' },
  { index: 7,  key: 'programCode',           name: '프로그램코드' },
  { index: 8,  key: 'programName',           name: '프로그램명' },
  { index: 9,  key: 'newProductType',        name: '신상품구분' },
  { index: 10, key: 'mainPrice',             name: '메인상품가격' },
  { index: 11, key: 'dealType',              name: '거래형태' },
  { index: 12, key: 'fixedFee',              name: '정액비' },
  { index: 13, key: 'makerSize',             name: '제조사규모' },
  { index: 14, key: 'daysAfterFirstAir',     name: '최초송출경과일' },
  { index: 15, key: 'preferredTime',         name: '희망시간대' },
  { index: 16, key: 'requestNote',           name: '기타요청사항' },
  { index: 17, key: 'videoStatus',           name: '방송영상상태' },
  { index: 18, key: 'targetQty1',            name: '목표수량' },
  { index: 19, key: 'partner1',              name: '협력사' },
  { index: 20, key: 'availableWeightedMin1', name: '가용가중분' },
  { index: 21, key: 'operationStartDate1',   name: '운영시작일' },
  { index: 22, key: 'targetQty2',            name: '목표수량' },
  { index: 23, key: 'partner2',              name: '협력사' },
  { index: 24, key: 'availableWeightedMin2', name: '가용가중분' },
  { index: 25, key: 'operationStartDate2',   name: '운영시작일' },
  { index: 26, key: 'dealTypeConverted',     name: '거래형태[변환]' },
  { index: 27, key: 'remainingSchedule',     name: '잔여편성' }
];

const PGM_SLOT_COLUMNS = [
  { index: 0, key: 'weekLabel',   name: '주차' },
  { index: 1, key: 'dateText',    name: 'DATE' },
  { index: 2, key: 'timeText',    name: 'TIME' },
  { index: 3, key: 'durationMin', name: '단순분' },
  { index: 4, key: 'weightedMin', name: '가중분' }
];

const PERFORMANCE_COLUMNS = [
  { index: 0, key: 'perfKey',              name: 'Key' },
  { index: 1, key: 'broadcastDate',        name: '방송일자' },
  { index: 2, key: 'broadcastTime',        name: '방송시간' },
  { index: 3, key: 'pgmCodeName',          name: '편성코드명' },
  { index: 4, key: 'salesPerWeightedMin',  name: '(전체)가중분당취급액' },
  { index: 5, key: 'profitPerWeightedMin', name: '(전체)가중분당한계이익' }
];

const PRE_SCHEDULE_COLUMNS = [
  { index: 0, key: 'pgmCodeName',       name: '편성코드명' },
  { index: 1, key: 'displayValue',      name: '노출값' },
  { index: 2, key: 'broadcastDateTime', name: '방송일시' },
  { index: 3, key: 'dateText',          name: '날짜' },
  { index: 4, key: 'orgName',           name: '조직명' },
  { index: 5, key: 'applyStatus',       name: '반영여부' }
];

const TARGET_COLUMNS = [
  { index: 0,  key: 'name',    name: '구분' },
  { index: 1,  key: 'month01', name: '1월' },
  { index: 2,  key: 'month02', name: '2월' },
  { index: 3,  key: 'month03', name: '3월' },
  { index: 4,  key: 'month04', name: '4월' },
  { index: 5,  key: 'month05', name: '5월' },
  { index: 6,  key: 'month06', name: '6월' },
  { index: 7,  key: 'month07', name: '7월' },
  { index: 8,  key: 'month08', name: '8월' },
  { index: 9,  key: 'month09', name: '9월' },
  { index: 10, key: 'month10', name: '10월' },
  { index: 11, key: 'month11', name: '11월' },
  { index: 12, key: 'month12', name: '12월' },
  { index: 13, key: 'linked',  name: '연계' }
];

/************************************
 * doGet
 ************************************/
function doGet(e) {
  try {
    const params    = e.parameter || {};
    const action    = params.action    || 'init';
    const startDate = params.startDate || '';
    const poolType  = params.poolType  || 'A';

    if (action === 'init') {
      if (!startDate) return jsonError_('startDate 파라미터가 없습니다.');
      const baseMonday = parseDateOnly_(startDate);
      if (isNaN(baseMonday.getTime())) return jsonError_('startDate 형식이 올바르지 않습니다. (YYYY-MM-DD)');
      if (baseMonday.getDay() !== 1)   return jsonError_('startDate는 반드시 월요일이어야 합니다.');
      return jsonOk_(buildInitJson_(startDate, poolType));
    }

    if (action === 'refreshPerformance') {
      return jsonOk_({ perfMap: buildPerfMap_() });
    }

    if (action === 'refreshProposals') {
      const pool              = (params.poolType || 'A') === 'B' ? 'B' : 'A';
      const proposalSheetName = DRAFT_CONFIG.PROPOSAL_SHEETS[pool];
      const perfMap           = buildPerfMap_();
      return jsonOk_({ proposalItems: loadProposalItemsAsJson_(proposalSheetName, perfMap) });
    }

    if (action === 'refreshPreSchedule') {
      const perfMap = buildPerfMap_();
      return jsonOk_({ preScheduleRows: loadPreScheduleRowsAsJson_(perfMap) });
    }

    return jsonError_('알 수 없는 action: ' + action);

  } catch (err) {
    return jsonError_(err.message || String(err));
  }
}

/************************************
 * 초기 데이터 통합 JSON
 ************************************/
function buildInitJson_(startDate, poolType) {
  const pool              = poolType === 'B' ? 'B' : 'A';
  const baseMonday        = parseDateOnly_(startDate);
  const targetMonth       = baseMonday.getMonth() + 1;
  const proposalSheetName = DRAFT_CONFIG.PROPOSAL_SHEETS[pool];

  const perfMap            = buildPerfMap_();
  const proposalItems      = loadProposalItemsAsJson_(proposalSheetName, perfMap);
  const pgmSlots           = loadPgmSlotsAsJson_(startDate);
  const preScheduleRows    = loadPreScheduleRowsAsJson_(perfMap);
  const targetMetrics      = loadTargetMetricsAsJson_(targetMonth);
  const weightedMinTargets = loadWeightedMinTargetAsJson_(startDate);

  return {
    meta: {
      startDate:           startDate,
      endDate:             formatDateOnly_(addDays_(baseMonday, 6)),
      targetMonth:         targetMonth,
      poolType:            pool,
      proposalSheetName:   proposalSheetName,
      proposalCount:       proposalItems.length,
      slotCount:           pgmSlots.length,
      perfMapCount:        Object.keys(perfMap).length,
      preScheduleCount:    preScheduleRows.length,
      targetSalesCount:    targetMetrics.sales.length,
      targetProfitCount:   targetMetrics.profit.length,
      weightedTargetCount: weightedMinTargets.length,
      createdAt:           Utilities.formatDate(new Date(), DRAFT_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
    },
    dictionaries: {
      proposalColumns:    PROPOSAL_COLUMNS,
      pgmSlotColumns:     PGM_SLOT_COLUMNS,
      performanceColumns: PERFORMANCE_COLUMNS,
      preScheduleColumns: PRE_SCHEDULE_COLUMNS,
      targetColumns:      TARGET_COLUMNS
    },
    proposalItems:      proposalItems,
    pgmSlots:           pgmSlots,
    perfMap:            perfMap,
    preScheduleRows:    preScheduleRows,
    targetMetrics:      targetMetrics,
    weightedMinTargets: weightedMinTargets
  };
}

/************************************
 * JSON 응답 헬퍼
 ************************************/
function jsonOk_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/************************************
 * 제안상품 JSON
 ************************************/
function loadProposalItemsAsJson_(sheetName, perfMap) {
  const ss    = SpreadsheetApp.openById(DRAFT_CONFIG.PROPOSAL_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('제안상품 시트를 찾을 수 없습니다: ' + sheetName);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const bColValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  let lastDataRow = 0;
  for (let i = 0; i < bColValues.length; i++) {
    if (String(bColValues[i][0]).trim() !== '') lastDataRow = i + 1;
  }
  if (lastDataRow === 0) return [];

  const values = sheet.getRange(2, 2, lastDataRow, 28).getDisplayValues();

  return values
    .filter(row => String(row[0]).trim() !== '')
    .map((row, idx) => {
      const item = {};
      PROPOSAL_COLUMNS.forEach(col => {
        item[col.key] = normalizeValue_(row[col.index], col.key);
      });
      item.source = { type: 'proposal', sheetName: sheetName, rowNumber: idx + 2 };
      item.itemId = makeHashId_(['ITEM', sheetName, idx + 2, item.pgmCode, item.videoCode, item.programCode]);

      const dealTypeForKey = item.dealTypeConverted || normalizeDealType_(item.dealType) || '';
      item.perfKey = dealTypeForKey ? dealTypeForKey + item.pgmCodeName : null;
      item.hasPerf = !!(item.perfKey && perfMap && perfMap[item.perfKey]);

      return item;
    });
}

/************************************
 * PGM 슬롯 JSON
 ************************************/
function loadPgmSlotsAsJson_(startDateText) {
  const startDate = parseDateOnly_(startDateText);
  const endDate   = addDays_(startDate, 6);

  const ss    = SpreadsheetApp.openById(DRAFT_CONFIG.PGM_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DRAFT_CONFIG.PGM_SHEET_NAME);
  if (!sheet) throw new Error('PGM 시트를 찾을 수 없습니다.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 5) return [];

  const values = sheet.getRange(5, 4, lastRow - 4, 5).getDisplayValues();

  return values
    .filter(row => row.some(cell => String(cell).trim() !== ''))
    .filter(row => String(row[0]).trim() !== '#N/A')
    .map((row, idx) => {
      const slot = {};
      PGM_SLOT_COLUMNS.forEach(col => {
        slot[col.key] = normalizeValue_(row[col.index], col.key);
      });
      const dateValue      = parsePgmDate_(slot.dateText, startDate);
      slot.dateValue       = dateValue ? formatDateOnly_(dateValue) : '';
      slot.dateKey         = slot.dateValue;
      slot.weightPerMinute = slot.durationMin > 0 ? slot.weightedMin / slot.durationMin : 0;
      slot.source          = { type: 'pgmSlot', sheetName: DRAFT_CONFIG.PGM_SHEET_NAME, rowNumber: idx + 5 };
      slot.slotId          = makeHashId_(['SLOT', slot.weekLabel, slot.dateText, slot.timeText, slot.durationMin, slot.weightedMin, idx + 5]);
      return slot;
    })
    .filter(slot => {
      if (!slot.dateValue) return false;
      const d = parseDateOnly_(slot.dateValue);
      return d >= startDate && d <= endDate;
    });
}

/************************************
 * 실적 perfMap 빌드
 * getValues()로 Date 객체를 직접 읽어 연도 포함 yyyy-MM-dd 형식으로 저장
 * → getDisplayValues()의 "MM/DD 요일" 표시 포맷에 의존하지 않음
 ************************************/
function toComparableDateStr_(dateStr) {
  const parts = String(dateStr).trim().split(/[.\-\/]/);
  if (parts.length === 3 && Number(parts[0]) > 2000) {
    return parts[0].padStart(4, '0') + parts[1].padStart(2, '0') + parts[2].padStart(2, '0');
  }
  return String(dateStr).replace(/\D/g, '');
}

function buildPerfMap_() {
  const ss    = SpreadsheetApp.openById(DRAFT_CONFIG.PROPOSAL_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DRAFT_CONFIG.PERFORMANCE_SHEET_NAME);
  if (!sheet) throw new Error('실적DB 시트를 찾을 수 없습니다.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  // getValues()로 읽어 Date 객체를 직접 처리 (getDisplayValues는 연도 없는 "MM/DD 요일" 반환)
  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  const map = {};
  values
    .filter(row => String(row[0]).trim() !== '')
    .forEach(row => {
      const perfKey = String(row[0]).trim();

      // row[1]이 Date 객체면 yyyy-MM-dd로 변환, 아니면 문자열 그대로
      const rawDate = row[1];
      const broadcastDate = rawDate instanceof Date && !isNaN(rawDate.getTime())
        ? Utilities.formatDate(rawDate, DRAFT_CONFIG.TIMEZONE, 'yyyy-MM-dd')
        : String(rawDate).trim();

      const broadcastTime        = String(row[2]).trim();
      const salesPerWeightedMin  = toNumber_(row[4]);
      const profitPerWeightedMin = toNumber_(row[5]);

      if (!map[perfKey]) {
        map[perfKey] = { salesPerWeightedMin, profitPerWeightedMin, broadcastDate, broadcastTime };
      } else {
        const existDate = toComparableDateStr_(map[perfKey].broadcastDate);
        const newDate   = toComparableDateStr_(broadcastDate);
        if (newDate > existDate) {
          map[perfKey] = { salesPerWeightedMin, profitPerWeightedMin, broadcastDate, broadcastTime };
        }
      }
    });

  return map;
}

/************************************
 * 선편성정보 JSON
 ************************************/
function loadPreScheduleRowsAsJson_(perfMap) {
  const ss    = SpreadsheetApp.openById(DRAFT_CONFIG.PRE_SCHEDULE_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DRAFT_CONFIG.PRE_SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error('선편성정보 시트를 찾을 수 없습니다.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 4) return [];

  const values = sheet.getRange(4, 8, lastRow - 3, 6).getDisplayValues();

  const DEAL_CHAR_MAP = {
    '위': '[위]', '모': '[모]', '직': '[직]',
    '혼': '[혼]', '액': '[액]', '률': '[률]'
  };

  return values
    .filter(row => String(row[0]).trim() !== '')
    .filter(row => String(row[5]).trim() === '반영')
    .map((row, idx) => {
      const pre = {};
      PRE_SCHEDULE_COLUMNS.forEach(col => {
        pre[col.key] = normalizeValue_(row[col.index], col.key);
      });
      pre.source        = { type: 'preSchedule', sheetName: DRAFT_CONFIG.PRE_SCHEDULE_SHEET_NAME, rowNumber: idx + 4 };
      pre.preScheduleId = makeHashId_(['PRE', pre.pgmCodeName, pre.displayValue, pre.broadcastDateTime, pre.orgName, idx + 4]);

      const dvMatch = String(pre.displayValue || '').match(/\d{2}:\d{2}(.)/);
      pre.dealTypeChar = dvMatch ? dvMatch[1] : '';

      const dealTypeNorm = DEAL_CHAR_MAP[pre.dealTypeChar] || '';
      pre.dealType = dealTypeNorm || null;
      pre.perfKey  = dealTypeNorm && pre.pgmCodeName ? dealTypeNorm + pre.pgmCodeName : null;
      pre.hasPerf  = !!(pre.perfKey && perfMap && perfMap[pre.perfKey]);

      return pre;
    });
}

/************************************
 * 목표 JSON (분당취급고 / 분당한계이익)
 ************************************/
function loadTargetMetricsAsJson_(targetMonth) {
  const ss = SpreadsheetApp.openById(DRAFT_CONFIG.TARGET_SPREADSHEET_ID);
  return {
    month:  targetMonth,
    sales:  loadOneTargetMetricSheet_(ss, DRAFT_CONFIG.TARGET_SALES_SHEET_NAME,  'salesPerMinuteTarget',  targetMonth),
    profit: loadOneTargetMetricSheet_(ss, DRAFT_CONFIG.TARGET_PROFIT_SHEET_NAME, 'profitPerMinuteTarget', targetMonth)
  };
}

function loadOneTargetMetricSheet_(ss, sheetName, valueKey, targetMonth) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('목표 시트를 찾을 수 없습니다: ' + sheetName);

  const values      = sheet.getRange('A1:N45').getDisplayValues();
  const header      = values[0];
  const monthHeader = targetMonth + '월';
  const monthCol    = header.indexOf(monthHeader);

  if (monthCol < 0) throw new Error(sheetName + ' 시트에서 월 헤더를 찾을 수 없습니다: ' + monthHeader);

  return values.slice(1)
    .filter(row => String(row[0]).trim() !== '')
    .map((row, idx) => {
      const name        = String(row[0]).trim();
      const value       = toNumber_(row[monthCol]);
      const linkedValue = toNumber_(row[13]);
      return {
        name,
        targetMonth,
        monthHeader,
        metricType:     valueKey,
        value,
        linkedValue,
        isCompanyTotal: name === '전사합계',
        source: {
          type:        'targetMetric',
          sheetName,
          rowNumber:   idx + 2,
          monthColumn: monthCol + 1
        },
        targetMetricId: makeHashId_(['TARGET', sheetName, name, monthHeader])
      };
    });
}

/************************************
 * 팀별 주간 가중분 목표 JSON
 ************************************/
function loadWeightedMinTargetAsJson_(startDateText) {
  const ss    = SpreadsheetApp.openById(DRAFT_CONFIG.WEIGHTED_TARGET_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DRAFT_CONFIG.WEIGHTED_TARGET_SHEET_NAME);
  if (!sheet) throw new Error('가중분목표 시트를 찾을 수 없습니다.');

  const startDate = parseDateOnly_(startDateText);
  const headerRow = sheet.getRange(8, 1, 1, 60).getValues()[0];

  const targetCols = [];
  for (let i = 0; i < 7; i++) {
    const targetDate = addDays_(startDate, i);
    const tYear  = targetDate.getFullYear();
    const tMonth = targetDate.getMonth();
    const tDay   = targetDate.getDate();
    for (let c = 0; c < headerRow.length; c++) {
      const cell = headerRow[c];
      if (cell instanceof Date &&
          cell.getFullYear() === tYear &&
          cell.getMonth()    === tMonth &&
          cell.getDate()     === tDay) {
        targetCols.push(c);
        break;
      }
    }
  }

  if (targetCols.length === 0) return [];

  const dataStartRow = 45;
  const maxRows      = 100;
  const lastCol      = Math.max(...targetCols) + 1;
  const values       = sheet.getRange(dataStartRow, 1, maxRows, lastCol).getDisplayValues();

  const result = [];
  for (let i = 0; i < values.length; i++) {
    const teamName = String(values[i][1]).trim();
    if (teamName === '') break;

    let weeklyTarget = 0;
    targetCols.forEach(colIdx => {
      weeklyTarget += toNumber_(values[i][colIdx]);
    });

    result.push({
      teamName,
      weeklyTarget,
      startDate: startDateText,
      targetMetricId: makeHashId_(['WGTARGET', teamName, startDateText])
    });
  }

  return result;
}

/************************************
 * dealType 정규화 (GAS 내부용)
 * React의 normalizeDealType과 동일 로직 유지
 ************************************/
function normalizeDealType_(value) {
  if (!value) return '';
  const dt = String(value).trim();
  if (/^\[[위모직혼액률]\]$/.test(dt)) return dt;
  if (dt.includes('위수탁')    || dt === '위') return '[위]';
  if (dt.includes('모바일광고') || dt === '모') return '[모]';
  if (dt.includes('직매입')    || dt === '직') return '[직]';
  if (dt.includes('혼합')      || dt === '혼') return '[혼]';
  if (dt.includes('정액')      || dt === '액') return '[액]';
  if (dt.includes('정률')      || dt === '률') return '[률]';
  return '';
}

/************************************
 * 값 정규화
 ************************************/
function normalizeValue_(value, key) {
  const text = String(value || '').trim();

  const numberKeys = {
    mainPrice:             true,
    fixedFee:              true,
    daysAfterFirstAir:     true,
    targetQty1:            true,
    availableWeightedMin1: true,
    targetQty2:            true,
    availableWeightedMin2: true,
    remainingSchedule:     true,
    durationMin:           true,
    weightedMin:           true,
    salesPerWeightedMin:   true,
    profitPerWeightedMin:  true
  };

  return numberKeys[key] ? toNumber_(text) : text;
}

function toNumber_(value) {
  if (value === '' || value == null) return 0;
  const text = String(value).replace(/,/g, '').replace(/%/g, '').trim();
  const num  = Number(text);
  return Number.isFinite(num) ? num : 0;
}

/************************************
 * 날짜 유틸
 ************************************/
function parseDateOnly_(value) {
  const parts = String(value).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function parsePgmDate_(dateText, baseMonday) {
  const text  = String(dateText || '').trim();
  const match = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day   = Number(match[2]);
  let year    = baseMonday.getFullYear();

  const d = new Date(year, month - 1, day);
  if (baseMonday.getMonth() === 11 && month === 1)  d.setFullYear(year + 1);
  if (baseMonday.getMonth() === 0  && month === 12) d.setFullYear(year - 1);

  return d;
}

function addDays_(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateOnly_(date) {
  return Utilities.formatDate(date, DRAFT_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/************************************
 * ID 생성
 ************************************/
function makeHashId_(parts) {
  const raw    = parts.join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  const hash   = digest.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
  return parts[0] + '_' + hash.slice(0, 12);
}

/************************************
 * GAS 팝업 (시트 내부 실행용)
 ************************************/
function showDraftSchedulePopup() {
  const html = HtmlService
    .createHtmlOutput(getDraftSchedulePopupHtml())
    .setWidth(440)
    .setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(html, '초안편성작업판 설정');
}

function getDraftSchedulePopupHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #222; }
    h3 { margin: 0 0 20px; font-size: 18px; }
    .field { margin-bottom: 18px; }
    label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 700; }
    input[type="date"], select {
      width: 100%; height: 38px; padding: 6px 10px;
      border: 1px solid #ccc; border-radius: 6px;
      font-size: 14px; box-sizing: border-box;
    }
    .desc { margin-top: 6px; font-size: 12px; color: #666; line-height: 1.4; }
    .button-row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
    button {
      height: 36px; padding: 0 16px; border: 0; border-radius: 6px;
      cursor: pointer; font-size: 13px; font-weight: 700;
    }
    .cancel { background: #e5e7eb; color: #111; }
    .submit { background: #0f172a; color: #fff; }
    .submit:disabled { opacity: 0.6; cursor: wait; }
    #loadingBox {
      display: none; margin-top: 20px; padding: 14px;
      border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe;
      color: #1e3a8a; font-size: 13px; line-height: 1.5;
    }
    .spinner {
      width: 18px; height: 18px; border: 3px solid #bfdbfe;
      border-top: 3px solid #2563eb; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block; vertical-align: middle; margin-right: 8px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h3>초안편성작업판 생성 조건</h3>
  <div class="field">
    <label>시작일자</label>
    <input type="date" id="startDate">
    <div class="desc">반드시 월요일을 선택해야 합니다.<br>해당 월요일 ~ 일요일까지 PGM 데이터를 불러옵니다.</div>
  </div>
  <div class="field">
    <label>풀 선택</label>
    <select id="poolType">
      <option value="A">풀 A</option>
      <option value="B">풀 B</option>
    </select>
    <div class="desc">A_Pool 또는 B_Pool 제안상품 데이터를 사용합니다.</div>
  </div>
  <div class="button-row">
    <button class="cancel" onclick="google.script.host.close()">취소</button>
    <button class="submit" id="submitBtn" onclick="submitForm()">실행</button>
  </div>
  <div id="loadingBox">
    <span class="spinner"></span>
    초안편성 JSON 생성 중입니다...<br>
    PGM / 제안상품 / 실적DB / 선편성 / 목표 데이터를 읽고 있습니다.
  </div>
  <script>
    function submitForm() {
      const startDate = document.getElementById('startDate').value;
      const poolType  = document.getElementById('poolType').value;
      if (!startDate) { alert('시작일자를 선택해주세요.'); return; }
      const d = new Date(startDate + 'T00:00:00');
      if (d.getDay() !== 1) { alert('시작일자는 반드시 월요일이어야 합니다.'); return; }
      document.getElementById('submitBtn').disabled  = true;
      document.getElementById('submitBtn').innerText = '실행 중...';
      document.getElementById('loadingBox').style.display = 'block';
      google.script.run
        .withSuccessHandler(function(result) { alert(result.message); google.script.host.close(); })
        .withFailureHandler(function(error) {
          document.getElementById('submitBtn').disabled  = false;
          document.getElementById('submitBtn').innerText = '실행';
          document.getElementById('loadingBox').style.display = 'none';
          alert('실행 오류: ' + error.message);
        })
        .runDraftScheduleBuilder({ startDate: startDate, poolType: poolType });
    }
  </script>
</body>
</html>`;
}

/************************************
 * GAS 팝업용 실행부
 ************************************/
function runDraftScheduleBuilder(options) {
  if (!options || !options.startDate || !options.poolType) {
    throw new Error('시작일자 또는 풀 선택값이 없습니다.');
  }
  const startDate  = options.startDate;
  const poolType   = options.poolType === 'B' ? 'B' : 'A';
  const baseMonday = parseDateOnly_(startDate);
  if (baseMonday.getDay() !== 1) throw new Error('시작일자는 반드시 월요일이어야 합니다.');

  const result = buildInitJson_(startDate, poolType);

  return {
    success: true,
    message:
      '초안편성 JSON 생성 완료\n\n' +
      '기간: '              + result.meta.startDate + ' ~ ' + result.meta.endDate + '\n' +
      '풀: '                + result.meta.proposalSheetName + '\n' +
      '제안상품: '          + result.meta.proposalCount + '건\n' +
      'PGM 슬롯: '          + result.meta.slotCount + '건\n' +
      '실적 perfMap: '      + result.meta.perfMapCount + '개 키\n' +
      '선편성정보: '        + result.meta.preScheduleCount + '건\n' +
      '분당취급고 목표: '   + result.meta.targetSalesCount + '건\n' +
      '분당한계이익 목표: ' + result.meta.targetProfitCount + '건\n' +
      '가중분 목표: '       + result.meta.weightedTargetCount + '건'
  };
}

/************************************
 * 디버그
 ************************************/
function debugDraftScheduleData() {
  const startDate = '2026-06-01';
  const poolType  = 'A';
  const result    = buildInitJson_(startDate, poolType);

  Logger.log('제안상품: '       + result.meta.proposalCount);
  Logger.log('PGM 슬롯: '       + result.meta.slotCount);
  Logger.log('실적 perfMap: '   + result.meta.perfMapCount + '개 키');
  Logger.log('선편성: '         + result.meta.preScheduleCount);
  Logger.log('가중분목표: '     + result.meta.weightedTargetCount);

  Logger.log('\n=== perfMap 샘플 (처음 5개) ===');
  const perfKeys = Object.keys(result.perfMap).slice(0, 5);
  perfKeys.forEach(k => Logger.log(k + ': ' + JSON.stringify(result.perfMap[k])));

  Logger.log('\n=== 제안상품 perfKey 샘플 ===');
  result.proposalItems.slice(0, 5).forEach(item => {
    Logger.log(item.pgmCodeName + ' | dealTypeConverted: ' + item.dealTypeConverted + ' | perfKey: ' + item.perfKey + ' | hasPerf: ' + item.hasPerf);
  });

  Logger.log('\n=== 선편성 perfKey 샘플 ===');
  result.preScheduleRows.slice(0, 5).forEach(pre => {
    Logger.log(pre.pgmCodeName + ' | dealTypeChar: ' + pre.dealTypeChar + ' | dealType: ' + pre.dealType + ' | perfKey: ' + pre.perfKey);
  });
}

function debugWeightedTarget() {
  const ss = SpreadsheetApp.openById('13D5TrPbu_8kcd2yuR9W9tSFQO5U0avYXvY3OLdfJG7I');
  const sheet = ss.getSheetByName('시트2');

  const headerRow = sheet.getRange(8, 1, 1, 60).getValues()[0];

  for (let c = 0; c < headerRow.length; c++) {
    const cell = headerRow[c];
    if (cell instanceof Date && cell.getFullYear() > 2000) {
      Logger.log('col ' + c + ': ' + cell + ' → ' + Utilities.formatDate(cell, 'Asia/Seoul', 'yyyy-MM-dd'));
    } else if (String(cell).trim() !== '') {
      Logger.log('col ' + c + ': [비날짜] ' + String(cell));
    }
  }

  const row45 = sheet.getRange(45, 1, 3, 5).getValues();
  Logger.log('45행~: ' + JSON.stringify(row45));
}
