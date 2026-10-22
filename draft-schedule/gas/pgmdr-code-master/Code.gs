// Deploy as a separate web app: execute as the deploying owner, access Anyone.
const PGMDR_CODE_MASTER = {
  spreadsheetId: '17Y0x6rqq32gNLte_gkXYqzfB4oaTLNadeoyd9oYv-28',
  sheetName: '시트2',
  databaseUrl: 'https://broadcast-schedule-6c97d-default-rtdb.asia-southeast1.firebasedatabase.app',
  path: 'cultureCodeMaster',
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action !== 'refresh') return pgmdrCodeMasterJsonResponse({ ok: false, error: 'Unknown action' });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return pgmdrCodeMasterJsonResponse({ ok: false, error: '편성코드 갱신이 이미 진행 중입니다.' });
  try {
    const result = pgmdrCodeMasterRefresh();
    return pgmdrCodeMasterJsonResponse(result);
  } catch (error) {
    console.error('PGMDR code master refresh failed: ' + error.message);
    return pgmdrCodeMasterJsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

// Run once in the editor to authorize and verify the owner's sheet/DB access.
function pgmdrCodeMasterRefresh() {
  const sheet = SpreadsheetApp.openById(PGMDR_CODE_MASTER.spreadsheetId)
    .getSheetByName(PGMDR_CODE_MASTER.sheetName);
  if (!sheet) throw new Error('편성코드 원본 시트를 찾을 수 없습니다.');
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error('원본 시트가 비어 있어 기존 DB를 유지합니다.');
  const items = sheet.getRange(1, 1, lastRow, 2).getDisplayValues()
    .map(([code, category], index) => ({
      id: String(index + 1).padStart(5, '0'),
      code: String(code || '').trim(),
      category: String(category || '').trim(),
    }))
    .filter(item => item.code);
  if (!items.length) throw new Error('유효한 편성코드가 없어 기존 DB를 유지합니다.');

  const updatedAt = Date.now();
  // Only this fixed path can be written. Never accept a DB path or data from callers.
  const response = UrlFetchApp.fetch(
    PGMDR_CODE_MASTER.databaseUrl + '/' + PGMDR_CODE_MASTER.path + '.json?print=silent',
    {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ items, count: items.length, updatedAt }),
      muteHttpExceptions: true,
    },
  );
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('편성코드 DB 저장 실패 (' + response.getResponseCode() + '). GAS 배포 계정의 Firebase 권한을 확인해주세요.');
  }
  return { ok: true, count: items.length, updatedAt };
}

function pgmdrCodeMasterJsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
