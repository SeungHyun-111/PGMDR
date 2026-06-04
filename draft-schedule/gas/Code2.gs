/**
 * PGMDR 편성운영 Web App (Code2.gs)
 *
 * 목적
 * - 프론트에서 startDate/poolType을 지정해 요청을 보낸다.
 * - 지정한 Google Sheet을 읽어 엔티티 정규화(uniqueKey, entityProps 등) 후 JSON으로 반환한다.
 * - Firebase 저장은 프론트(sessionActions.js)가 담당한다.
 *
 * Script Properties
 * - (없음 - Firebase 직접 전송 없음)
 */

const OPS_CONFIG = {
  timezone: "Asia/Seoul",
  defaultSheetName: "PGM",
};

// 열 순서 고정 (E:Q - 0-based 4~16) - Code.gs PGM_SLOT_COLUMNS 방식과 동일
const OPS_COLUMNS = [
  { index: 4,  key: "dateText"        },  // E: DATE
  { index: 5,  key: "timeText"        },  // F: TIME
  { index: 6,  key: "durationMin"     },  // G: 단순분
  { index: 7,  key: "weightedMin"     },  // H: 가중분
  { index: 8,  key: "team"            },  // I: 팀명
  { index: 9,  key: "multiChannel"    },  // J: 다원방송
  { index: 10, key: "mdCategory"      },  // K: MD분류
  { index: 11, key: "pgmCodeName"     },  // L: 상품명
  { index: 12, key: "newProductType"  },  // M: 재/신상품
  { index: 13, key: "dealTypeRaw"     },  // N: 혼합/직매입
  { index: 14, key: "bigImport"       },  // O: 대기업/수입여부
  { index: 15, key: "memoCode"        },  // P: 메모코드
  { index: 16, key: "scheduleComment" },  // Q: 편성C
];

const OPS_CA_RATIO_TABLE = [
  [30, 30, 30, 30, 30, 30, 30],
  [40, 40, 40, 40, 40, 40, 40],
  [40, 40, 40, 40, 40, 40, 40],
  [40, 40, 40, 40, 40, 40, 40],
  [40, 40, 40, 40, 40, 40, 40],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 25, 25],
  [25, 25, 25, 25, 25, 20, 20],
  [20, 20, 20, 20, 20, 20, 20],
  [20, 20, 20, 20, 20, 20, 20],
  [20, 20, 20, 20, 20, 20, 20],
  [20, 20, 20, 20, 20, 20, 20],
];

function doGet(e) {
  const params = (e && e.parameter) || {};

  try {
    if (params.action === "health") {
      return OPS_jsonOk_({ ok: true, app: "PGMDR 편성운영" });
    }
    if (!params.startDate) return OPS_jsonError_("startDate 파라미터가 없습니다.");
    if (!params.endDate) return OPS_jsonError_("endDate 파라미터가 없습니다.");
    const payload = OPS_buildPayloadFromSheet_(params);
    return OPS_jsonOk_(payload);
  } catch (err) {
    return OPS_jsonError_(err);
  }
}

function OPS_buildPayloadFromSheet_(params) {
  const startDate = OPS_requireDate_(params.startDate, "startDate");
  const endDate   = OPS_requireDate_(params.endDate, "endDate");
  const poolType  = params.poolType || "A";
  const sheetName = params.sheetName || OPS_CONFIG.defaultSheetName;

  const sheet = OPS_getSheet_(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error("동기화할 데이터가 없습니다.");

  const rows = values
    .slice(1)
    .map(function (row, index) { return OPS_readRow_(row, startDate, index + 2); })
    .filter(function (row) {
      return row && row.dateKey >= startDate && row.dateKey <= endDate;
    });

  const slots = [];
  const slotMap = {};
  const blocks = {};
  const splitSlots = {};
  const now = Date.now();

  rows.forEach(function (row, index) {
    const slotKey = row.dateKey + " " + row.timeText;
    if (!slotMap[slotKey]) {
      const slotId = OPS_makeSlotId_(row.dateKey, row.timeText, index);
      slotMap[slotKey] = {
        slotId: slotId,
        dateKey: row.dateKey,
        dateValue: row.dateKey,
        dateText: row.dateText,
        timeText: row.timeText,
        durationMin: row.durationMin,
        weightedMin: row.weightedMin,
        weightPerMinute: row.durationMin ? row.weightedMin / row.durationMin : 0,
        channel: "ALL",
      };
      slots.push(slotMap[slotKey]);
    }

    const slot = slotMap[slotKey];
    const channel = OPS_normalizeChannel_(row.multiChannel);
    if (channel !== "ALL") splitSlots[slot.slotId] = true;

    const blockKey = channel === "ALL" ? slot.slotId : slot.slotId + "_" + channel;
    const dealType = OPS_normalizeDealType_(row.dealTypeRaw, row.team);
    const weightedMin = channel === "ALL"
      ? slot.weightedMin
      : OPS_splitWeightedMin_(slot.weightedMin, row.dateKey, row.timeText, channel);

    blocks[blockKey] = {
      slotId: slot.slotId,
      blockKey: blockKey,
      dateKey: row.dateKey,
      timeText: row.timeText,
      durationMin: row.durationMin,
      weightedMin: weightedMin,
      channel: channel,
      pgmCodeName: row.pgmCodeName,
      mdTeam: row.team,
      orgName: row.team,
      mdCategory: row.mdCategory,
      dealType: dealType,
      dealTypeConverted: dealType,
      dealTypeChar: OPS_dealTypeChar_(dealType),
      memoCode: row.memoCode,
      requestNote: row.bigImport,
      scheduleComment: row.scheduleComment,
      annotation: null,
      newProductType: OPS_normalizeNewProductType_(row.newProductType),
      perfKey: row.pgmCodeName ? dealType + row.pgmCodeName : null,
      isDefault: false,
      isPreSchedule: true,
      assignedAt: now,
    };
  });

  return {
    weekKey: startDate + "_" + poolType,
    startDate: startDate,
    endDate: endDate,
    poolType: poolType,
    sheetName: sheetName,
    generatedAt: now,
    rowCount: rows.length,
    pgmSlots: slots,
    scheduleBlocks: blocks,
    splitSlots: splitSlots,
  };
}

function OPS_readRow_(row, startDate, rowNumber) {
  const dateText = String(row[4] || "").trim();
  const timeText = OPS_normalizeTime_(String(row[5] || "").trim());
  if (!dateText || !timeText) return null;

  return {
    rowNumber: rowNumber,
    dateText: dateText,
    dateKey: OPS_parseDateKey_(dateText, startDate),
    timeText: timeText,
    durationMin: OPS_number_(row[6]),
    weightedMin: OPS_number_(row[7]),
    team: OPS_normalizeTeamName_(row[8]),
    multiChannel: String(row[9] || "").trim(),
    mdCategory: String(row[10] || "").trim(),
    pgmCodeName: String(row[11] || "").trim(),
    newProductType: String(row[12] || "").trim(),
    dealTypeRaw: String(row[13] || "").trim(),
    bigImport: String(row[14] || "").trim(),
    memoCode: String(row[15] || "").trim(),
    scheduleComment: String(row[16] || "").trim(),
  };
}

function OPS_normalizeDealType_(value, team) {
  const raw = String(value || "").trim();
  const teamName = String(team || "").trim();
  if (!raw) return teamName === "문화서비스팀" || teamName === "문화서비스" ? "[률]" : "[위]";
  if (/^\[[위모직혼액률]\]$/.test(raw)) return raw;
  const parenMatch = raw.match(/\((.)\)/);
  if (parenMatch) {
    const MAP = {
      "위": "[위]",
      "모": "[모]",
      "광": "[모]",
      "직": "[직]",
      "혼": "[혼]",
      "액": "[액]",
      "정": "[액]",
      "률": "[률]",
    };
    if (MAP[parenMatch[1]]) return MAP[parenMatch[1]];
  }
  if (raw.includes("위수탁") || raw === "위" || raw === "기타") return "[위]";
  if (raw.includes("직매입") || raw === "직") return "[직]";
  if (raw.includes("모바일광고") || raw === "모") return "[모]";
  if (raw.includes("혼합") || raw.includes("특약매입") || raw.includes("특약") || raw === "혼") return "[혼]";
  if (raw.includes("정액") || raw.includes("정액수수료") || raw === "액" || raw === "정") return "[액]";
  if (raw.includes("정률") || raw.includes("효율") || raw === "률") return "[률]";
  return "[위]";
}

function OPS_normalizeTeamName_(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.endsWith("팀") ? raw : raw + "팀";
}

function OPS_normalizeNewProductType_(value) {
  const raw = String(value || "").trim();
  if (raw === "(재)") return "재녹화";
  if (raw === "(신)") return "신상품";
  return "기존";
}

function OPS_dealTypeChar_(dealType) {
  const match = String(dealType || "").match(/\[(.)\]/);
  return match ? match[1] : "위";
}

function OPS_normalizeChannel_(value) {
  const raw = String(value || "").toUpperCase();
  if (raw.indexOf("CA") !== -1 || raw.indexOf("CH1") !== -1) return "CA";
  if (raw.indexOf("IP") !== -1 || raw.indexOf("CH2") !== -1) return "IP";
  return "ALL";
}

function OPS_normalizeTime_(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return "";
  return String(Number(match[1])) + ":" + OPS_pad2_(match[2]);
}

function OPS_number_(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return isFinite(number) ? number : 0;
}

function OPS_makeSlotId_(dateKey, timeText, index) {
  return "SLOT_" + OPS_md5Hex_([dateKey, timeText, index].join("|")).slice(0, 12);
}

function OPS_splitWeightedMin_(weightedMin, dateKey, timeText, channel) {
  const dayIndex = OPS_dayIndex_(dateKey);
  const hourIndex = Number(String(timeText || "0:00").split(":")[0]) % 24;
  const ca = Math.round(weightedMin * OPS_CA_RATIO_TABLE[hourIndex][dayIndex] / 100);
  return channel === "CA" ? ca : weightedMin - ca;
}

function OPS_dayIndex_(dateKey) {
  const day = new Date(dateKey + "T00:00:00").getDay();
  return day === 0 ? 6 : day - 1;
}

function OPS_requireDate_(value, name) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
    throw new Error(name + "는 YYYY-MM-DD 형식이어야 합니다.");
  return raw;
}

function OPS_parseDateKey_(dateText, startDate) {
  const match = String(dateText || "").match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) throw new Error("DATE 형식을 해석할 수 없습니다: " + dateText);
  const year = String(startDate).slice(0, 4);
  return year + "-" + OPS_pad2_(match[1]) + "-" + OPS_pad2_(match[2]);
}

function OPS_getSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("시트를 찾을 수 없습니다: " + sheetName);
  return sheet;
}

function OPS_jsonOk_(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function OPS_jsonError_(err) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }))
    .setMimeType(ContentService.MimeType.JSON);
}

function OPS_md5Hex_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(text), Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    return ("0" + (b & 0xff).toString(16)).slice(-2);
  }).join("");
}

function OPS_pad2_(value) {
  return String(Number(value)).padStart(2, "0");
}
