/**
 * PGMDR 편성운영 Web App
 *
 * 목적
 * - 지정한 Google Sheet 양식을 우리 Firebase 세션 규격으로 변환한다.
 * - 편성운영 버전(sessions/{weekKey}/versions/ops)에 동기화한다.
 * - 웹앱 화면에서 미리보기, 편성운영 동기화, 현재 버전 불러오기를 제공한다.
 *
 * Script Properties
 * - FB_BASE_URL: https://pgmdr-87328-default-rtdb.asia-southeast1.firebasedatabase.app
 * - FB_AUTH: Firebase Database secret 또는 REST auth token. 공개 규칙이면 비워도 됨.
 */

const OPS_CONFIG = {
  timezone: "Asia/Seoul",
  defaultPoolType: "A",
  defaultSheetName: "편성운영",
  firebaseBaseUrl:
    PropertiesService.getScriptProperties().getProperty("FB_BASE_URL") || "",
  firebaseAuth:
    PropertiesService.getScriptProperties().getProperty("FB_AUTH") || "",
  versionDraft: "draft",
  versionSales: "sales",
  versionOps: "ops",
};

const OPS_HEADERS = [
  "DATE",
  "TIME",
  "단순분",
  "가중분",
  "팀명",
  "다원방송",
  "MD분류",
  "상품명",
  "재/신상품",
  "혼합/직매입",
  "대기업/수입여부",
  "메모코드",
  "편성C",
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
  const action = params.action || "";

  if (action) {
    try {
      return OPS_jsonOk_(OPS_handleAction_(action, params));
    } catch (err) {
      return OPS_jsonError_(err);
    }
  }

  return HtmlService.createHtmlOutput(OPS_renderWebApp_())
    .setTitle("PGMDR 편성운영")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function OPS_handleAction_(action, params) {
  if (action === "health") {
    return {
      ok: true,
      app: "PGMDR 편성운영",
      time: OPS_nowText_(),
    };
  }

  if (action === "previewSheet") {
    const payload = OPS_buildPayloadFromSheet_(params);
    return OPS_makePreview_(payload);
  }

  if (action === "syncSheetToOps") {
    const payload = OPS_buildPayloadFromSheet_(params);
    OPS_writeOpsVersion_(payload, params);
    return OPS_makePreview_(payload);
  }

  if (action === "loadVersionToSheet") {
    const versionId = params.versionId || OPS_CONFIG.versionSales;
    return OPS_loadVersionToSheet_(params, versionId);
  }

  throw new Error("지원하지 않는 action입니다: " + action);
}

function OPS_buildPayloadFromSheet_(params) {
  const startDate = OPS_requireDate_(params.startDate, "startDate");
  const poolType = params.poolType || OPS_CONFIG.defaultPoolType;
  const sheetName = params.sheetName || OPS_CONFIG.defaultSheetName;
  const userName = params.userName || Session.getActiveUser().getEmail() || "";
  const sheet = OPS_getSheet_(sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) throw new Error("동기화할 데이터가 없습니다.");

  const headerMap = OPS_makeHeaderMap_(values[0]);
  const rows = values
    .slice(1)
    .map((row, index) => OPS_readRow_(row, headerMap, startDate, index + 2))
    .filter(Boolean);

  const slots = [];
  const slotMap = {};
  const blocks = {};
  const splitSlots = {};
  const entityProps = {};
  const scheduledUniqueKeys = {};
  const now = Date.now();

  rows.forEach((row, index) => {
    const slotKey = row.dateKey + " " + row.timeText;
    if (!slotMap[slotKey]) {
      const slotId = OPS_makeSlotId_(row.dateKey, row.timeText);
      slotMap[slotKey] = {
        slotId: slotId,
        dateKey: row.dateKey,
        dateValue: row.dateKey,
        dateText: row.dateText,
        timeText: row.timeText,
        durationMin: row.durationMin,
        weightedMin: row.weightedMin,
        weightPerMinute: row.durationMin
          ? row.weightedMin / row.durationMin
          : 0,
        weekLabel: OPS_makeWeekLabel_(row.dateKey),
        channel: "ALL",
        source: {
          type: "opsWebApp",
          sheetName: sheetName,
          rowNumber: row.rowNumber,
        },
      };
      slots.push(slotMap[slotKey]);
    }

    const slot = slotMap[slotKey];
    const channel = OPS_normalizeChannel_(row.multiChannel);
    if (channel !== "ALL") splitSlots[slot.slotId] = true;

    const blockKey =
      channel === "ALL" ? slot.slotId : slot.slotId + "_" + channel;
    const dealType = OPS_normalizeDealType_(row.dealTypeRaw);
    const uniqueKey =
      "2_ops_" +
      OPS_sha1Hex_(
        [row.dateKey, row.timeText, channel, index, row.pgmCodeName].join("|"),
      ).slice(0, 16);
    const weightedMin =
      channel === "ALL"
        ? slot.weightedMin
        : OPS_splitWeightedMin_(
            slot.weightedMin,
            row.dateKey,
            row.timeText,
            channel,
          );

    const block = {
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
      newProductType: row.newProductType,
      dealType: dealType,
      dealTypeConverted: dealType,
      dealTypeChar: OPS_dealTypeChar_(dealType),
      requestNote: row.bigImport,
      memoCode: row.memoCode,
      scheduleComment: row.scheduleComment,
      perfKey: row.pgmCodeName ? dealType + row.pgmCodeName : null,
      uniqueKey: uniqueKey,
      isDefault: false,
      isPreSchedule: true,
      assignedAt: now,
    };

    blocks[blockKey] = block;
    scheduledUniqueKeys[uniqueKey] = true;
    entityProps[uniqueKey] = OPS_extractEntityProps_(block);
  });

  return {
    weekKey: startDate + "_" + poolType,
    startDate: startDate,
    poolType: poolType,
    userName: userName,
    sheetName: sheetName,
    generatedAt: now,
    rows: rows,
    pgmSlots: slots,
    scheduleBlocks: blocks,
    splitSlots: splitSlots,
    entityProps: entityProps,
    scheduledUniqueKeys: scheduledUniqueKeys,
  };
}

function OPS_writeOpsVersion_(payload) {
  const weekKey = payload.weekKey;
  const opsPath = "sessions/" + weekKey + "/versions/" + OPS_CONFIG.versionOps;
  const updatedAt = Date.now();
  const updatedBy = payload.userName || "";

  OPS_firebasePut_(
    "sessions/" + weekKey + "/gasData/pgmSlots",
    payload.pgmSlots,
  );
  OPS_firebasePatch_("sessions/" + weekKey + "/gasData/meta", {
    startDate: payload.startDate,
    endDate: OPS_lastDateKey_(payload.pgmSlots),
    poolType: payload.poolType,
    slotCount: payload.pgmSlots.length,
    opsSyncedAt: updatedAt,
    opsSyncedBy: updatedBy,
  });
  OPS_firebasePut_(opsPath, {
    proposalItems: [],
    scheduleBlocks: payload.scheduleBlocks,
    entityProps: payload.entityProps,
    splitSlots: payload.splitSlots,
    customSlots: {},
    starred: {},
    scheduledItemIds: {},
    scheduledUniqueKeys: payload.scheduledUniqueKeys,
    manualInputs: {},
    updatedAt: updatedAt,
    updatedBy: updatedBy,
    sourceVersionId: OPS_CONFIG.versionSales,
  });
  OPS_firebasePut_(
    "sessions/" + weekKey + "/versionMeta/" + OPS_CONFIG.versionOps,
    {
      updatedAt: updatedAt,
      updatedBy: updatedBy,
      sourceVersionId: OPS_CONFIG.versionSales,
      sheetName: payload.sheetName,
    },
  );
}

function OPS_loadVersionToSheet_(params, versionId) {
  const startDate = OPS_requireDate_(params.startDate, "startDate");
  const poolType = params.poolType || OPS_CONFIG.defaultPoolType;
  const sheetName = params.sheetName || OPS_CONFIG.defaultSheetName;
  const weekKey = startDate + "_" + poolType;
  const version = OPS_firebaseGet_(
    "sessions/" + weekKey + "/versions/" + versionId,
  );
  const blocks = (version && version.scheduleBlocks) || {};
  const rows = OPS_blocksToSheetRows_(blocks);
  const sheet = OPS_getSheet_(sheetName);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, OPS_HEADERS.length).setValues([OPS_HEADERS]);
  if (rows.length > 0)
    sheet.getRange(2, 1, rows.length, OPS_HEADERS.length).setValues(rows);

  return {
    versionId: versionId,
    weekKey: weekKey,
    sheetName: sheetName,
    rowCount: rows.length,
  };
}

function OPS_blocksToSheetRows_(blocks) {
  return Object.keys(blocks)
    .map(function (key) {
      return blocks[key];
    })
    .filter(function (block) {
      return block && !block.isDefault;
    })
    .sort(function (a, b) {
      const ad =
        String(a.dateKey || "") + " " + OPS_timeSortKey_(a.timeText || "");
      const bd =
        String(b.dateKey || "") + " " + OPS_timeSortKey_(b.timeText || "");
      if (ad !== bd) return ad < bd ? -1 : 1;
      return String(a.channel || "").localeCompare(String(b.channel || ""));
    })
    .map(function (block) {
      return [
        OPS_dateText_(block.dateKey),
        block.timeText || "",
        block.durationMin || "",
        block.weightedMin || "",
        block.mdTeam || block.orgName || "",
        OPS_channelText_(block.channel),
        block.mdCategory || "",
        block.pgmCodeName || "",
        block.newProductType || "",
        OPS_dealRawText_(block.dealTypeConverted || block.dealType),
        block.requestNote || "",
        block.memoCode || "",
        block.scheduleComment || "",
      ];
    });
}

function OPS_readRow_(row, headerMap, startDate, rowNumber) {
  const dateText = OPS_cell_(row, headerMap, "DATE");
  const timeText = OPS_normalizeTime_(OPS_cell_(row, headerMap, "TIME"));
  if (!dateText || !timeText) return null;

  return {
    rowNumber: rowNumber,
    dateText: dateText,
    dateKey: OPS_parseDateKey_(dateText, startDate),
    timeText: timeText,
    durationMin: OPS_number_(OPS_cell_(row, headerMap, "단순분")),
    weightedMin: OPS_number_(OPS_cell_(row, headerMap, "가중분")),
    team: OPS_cell_(row, headerMap, "팀명"),
    multiChannel: OPS_cell_(row, headerMap, "다원방송"),
    mdCategory: OPS_cell_(row, headerMap, "MD분류"),
    pgmCodeName: OPS_cell_(row, headerMap, "상품명"),
    newProductType: OPS_cell_(row, headerMap, "재/신상품"),
    dealTypeRaw: OPS_cell_(row, headerMap, "혼합/직매입"),
    bigImport: OPS_cell_(row, headerMap, "대기업/수입여부"),
    memoCode: OPS_cell_(row, headerMap, "메모코드"),
    scheduleComment: OPS_cell_(row, headerMap, "편성C"),
  };
}

function OPS_makeHeaderMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    map[String(header || "").trim()] = index;
  });
  OPS_HEADERS.forEach(function (header) {
    if (map[header] == null) throw new Error("필수 헤더가 없습니다: " + header);
  });
  return map;
}

function OPS_cell_(row, headerMap, header) {
  const index = headerMap[header];
  return index == null ? "" : String(row[index] || "").trim();
}

function OPS_makePreview_(payload) {
  return {
    weekKey: payload.weekKey,
    sheetName: payload.sheetName,
    rowCount: payload.rows.length,
    slotCount: payload.pgmSlots.length,
    blockCount: Object.keys(payload.scheduleBlocks).length,
    splitSlotCount: Object.keys(payload.splitSlots).length,
    firstSlot: payload.pgmSlots[0] || null,
    firstBlock:
      payload.scheduleBlocks[Object.keys(payload.scheduleBlocks)[0]] || null,
  };
}

function OPS_getSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("시트를 찾을 수 없습니다: " + sheetName);
  return sheet;
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

function OPS_dateText_(dateKey) {
  if (!dateKey) return "";
  const d = new Date(dateKey + "T00:00:00");
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    OPS_pad2_(d.getMonth() + 1) +
    "/" +
    OPS_pad2_(d.getDate()) +
    "(" +
    labels[d.getDay()] +
    ")"
  );
}

function OPS_normalizeTime_(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return "";
  return String(Number(match[1])) + ":" + OPS_pad2_(match[2]);
}

function OPS_timeSortKey_(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "9999";
  return OPS_pad2_(match[1]) + match[2];
}

function OPS_number_(value) {
  const number = Number(String(value || "").replace(/,/g, ""));
  return isFinite(number) ? number : 0;
}

function OPS_normalizeChannel_(value) {
  const raw = String(value || "").toUpperCase();
  if (raw.indexOf("CA") !== -1 || raw.indexOf("CH1") !== -1) return "CA";
  if (raw.indexOf("IP") !== -1 || raw.indexOf("CH2") !== -1) return "IP";
  return "ALL";
}

function OPS_channelText_(channel) {
  if (channel === "CA") return "CH1(CA)";
  if (channel === "IP") return "CH2(IP)";
  return "";
}

function OPS_normalizeDealType_(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/\((.)\)/);
  return match ? "[" + match[1] + "]" : "[위]";
}

function OPS_dealRawText_(dealType) {
  const match = String(dealType || "").match(/\[(.)\]/);
  if (!match || match[1] === "위") return "";
  return "(" + match[1] + ")";
}

function OPS_dealTypeChar_(dealType) {
  const match = String(dealType || "").match(/\[(.)\]/);
  return match ? match[1] : "위";
}

function OPS_splitWeightedMin_(weightedMin, dateKey, timeText, channel) {
  const dayIndex = OPS_dayIndex_(dateKey);
  const hourIndex = Number(String(timeText || "0:00").split(":")[0]) % 24;
  const ca = Math.round(
    (weightedMin * OPS_CA_RATIO_TABLE[hourIndex][dayIndex]) / 100,
  );
  return channel === "CA" ? ca : weightedMin - ca;
}

function OPS_dayIndex_(dateKey) {
  const day = new Date(dateKey + "T00:00:00").getDay();
  return day === 0 ? 6 : day - 1;
}

function OPS_makeSlotId_(dateKey, timeText) {
  return "SLOT_" + OPS_sha1Hex_(dateKey + "_" + timeText).slice(0, 12);
}

function OPS_makeWeekLabel_(dateKey) {
  const d = new Date(dateKey + "T00:00:00");
  return (
    OPS_pad2_(d.getMonth() + 1) + "월" + Math.ceil(d.getDate() / 7) + "주차"
  );
}

function OPS_extractEntityProps_(block) {
  return {
    pgmCodeName: block.pgmCodeName,
    mdTeam: block.mdTeam,
    orgName: block.orgName,
    mdCategory: block.mdCategory,
    dealType: block.dealType,
    dealTypeConverted: block.dealTypeConverted,
    dealTypeChar: block.dealTypeChar,
    memoCode: block.memoCode,
    requestNote: block.requestNote,
    scheduleComment: block.scheduleComment,
    newProductType: block.newProductType,
    perfKey: block.perfKey,
  };
}

function OPS_lastDateKey_(slots) {
  if (!slots || slots.length === 0) return "";
  return slots
    .map(function (slot) {
      return slot.dateKey;
    })
    .sort()
    .pop();
}

function OPS_firebaseUrl_(path) {
  if (!OPS_CONFIG.firebaseBaseUrl)
    throw new Error("Script Properties에 FB_BASE_URL이 없습니다.");
  const base = OPS_CONFIG.firebaseBaseUrl.replace(/\/$/, "");
  const auth = OPS_CONFIG.firebaseAuth
    ? "?auth=" + encodeURIComponent(OPS_CONFIG.firebaseAuth)
    : "";
  return base + "/" + path.replace(/^\//, "") + ".json" + auth;
}

function OPS_firebaseGet_(path) {
  const res = UrlFetchApp.fetch(OPS_firebaseUrl_(path), {
    method: "get",
    muteHttpExceptions: true,
  });
  return OPS_parseFirebaseResponse_(res, path);
}

function OPS_firebasePut_(path, value) {
  const res = UrlFetchApp.fetch(OPS_firebaseUrl_(path), {
    method: "put",
    contentType: "application/json",
    payload: JSON.stringify(value),
    muteHttpExceptions: true,
  });
  return OPS_parseFirebaseResponse_(res, path);
}

function OPS_firebasePatch_(path, value) {
  const res = UrlFetchApp.fetch(OPS_firebaseUrl_(path), {
    method: "patch",
    contentType: "application/json",
    payload: JSON.stringify(value),
    muteHttpExceptions: true,
  });
  return OPS_parseFirebaseResponse_(res, path);
}

function OPS_parseFirebaseResponse_(res, path) {
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error("Firebase 요청 실패(" + code + "): " + path + " / " + text);
  }
  return text ? JSON.parse(text) : null;
}

function OPS_sha1Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(text))
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ("0" + value.toString(16)).slice(-2);
    })
    .join("");
}

function OPS_pad2_(value) {
  return String(Number(value)).padStart(2, "0");
}

function OPS_nowText_() {
  return Utilities.formatDate(
    new Date(),
    OPS_CONFIG.timezone,
    "yyyy-MM-dd HH:mm:ss",
  );
}

function OPS_jsonOk_(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, data: data }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function OPS_jsonError_(err) {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: false,
      error: String(err && err.message ? err.message : err),
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function OPS_renderWebApp_() {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:Arial,"Noto Sans KR",sans-serif;margin:0;background:#f8fafc;color:#172033}
    .wrap{padding:18px;max-width:860px;margin:0 auto}
    h1{font-size:18px;margin:0 0 14px}
    .bar{display:grid;grid-template-columns:120px 1fr;gap:8px 12px;background:#fff;border:1px solid #dbe3ef;border-radius:8px;padding:14px}
    label{font-size:12px;font-weight:700;color:#475569;align-self:center}
    input,select{height:30px;border:1px solid #cbd5e1;border-radius:6px;padding:0 9px;font-size:12px}
    .actions{display:flex;gap:8px;margin-top:12px}
    button{height:32px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:12px;font-weight:800;cursor:pointer;padding:0 12px}
    button.primary{background:#be123c;border-color:#fda4af;color:#fff}
    button.secondary{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
    pre{white-space:pre-wrap;background:#111827;color:#d1fae5;border-radius:8px;padding:12px;font-size:11px;min-height:180px;overflow:auto}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>PGMDR 편성운영 동기화</h1>
    <div class="bar">
      <label>시트명</label><input id="sheetName" value="${OPS_CONFIG.defaultSheetName}">
      <label>시작일</label><input id="startDate" placeholder="YYYY-MM-DD">
      <label>구분</label><select id="poolType"><option>A</option><option>B</option></select>
      <label>작성자</label><input id="userName" placeholder="이름">
    </div>
    <div class="actions">
      <button class="secondary" onclick="run('previewSheet')">미리보기</button>
      <button class="primary" onclick="run('syncSheetToOps')">편성운영 동기화</button>
      <button onclick="run('loadVersionToSheet&versionId=sales')">영업팀 공유 불러오기</button>
      <button onclick="run('loadVersionToSheet&versionId=ops')">편성운영 불러오기</button>
    </div>
    <p style="font-size:11px;color:#64748b">동기화는 Firebase ops 버전을 덮어씁니다. 실행 전 미리보기로 건수를 확인하세요.</p>
    <pre id="out">대기 중...</pre>
  </div>
  <script>
    function qs(action){
      const p = new URLSearchParams();
      const parts = action.split('&');
      p.set('action', parts.shift());
      parts.forEach(part => {
        const pair = part.split('=');
        p.set(pair[0], pair[1] || '');
      });
      ['sheetName','startDate','poolType','userName'].forEach(id => p.set(id, document.getElementById(id).value));
      return '?' + p.toString();
    }
    async function run(action){
      const out = document.getElementById('out');
      out.textContent = '실행 중...';
      const res = await fetch(qs(action));
      out.textContent = JSON.stringify(await res.json(), null, 2);
    }
  </script>
</body>
</html>`;
}
