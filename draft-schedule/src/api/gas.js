const MAIN_GAS_URL = 'https://script.google.com/macros/s/AKfycbzlnzcV5DkCNwAZcOrdtJnCfGpCLmu5-tA9eF8N2Rs4hS15N61p0h8m7BQqTVxwX7g3/exec'
const OPS_GAS_URL = 'https://script.google.com/macros/s/AKfycbz9e0_2L6wX3Lm7uKWLfReZrm-LNRFxg8f_EeHVKwqaLZrx0neyHss9fORPhhvFppIA/exec'

async function gasGet(url, params) {
  if (!url) throw new Error('편성운영 GAS 웹앱 URL이 설정되지 않았습니다.')
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${url}?${qs}`)
  const json = await res.json()
  if (!res.ok || json.success === false || json.ok === false) {
    throw new Error(json.error || 'GAS 호출 실패')
  }
  if (json.success !== true && json.ok !== true) {
    throw new Error(json.error || 'GAS 응답 형식을 확인할 수 없습니다.')
  }
  return json.data
}

export const fetchInitData            = (startDate, poolType = 'A') => gasGet(MAIN_GAS_URL, { action: 'init',               startDate, poolType })
export const fetchRefreshPerformance  = ({ afterDate = '' } = {}) => gasGet(MAIN_GAS_URL, { action: 'refreshPerformance', afterDate             })
export const fetchRefreshProposals    = (poolType = 'A')             => gasGet(MAIN_GAS_URL, { action: 'refreshProposals',   poolType            })
export const fetchRefreshPreSchedule  = ()                           => gasGet(MAIN_GAS_URL, { action: 'refreshPreSchedule'                      })
export const syncOpsVersion           = ({ startDate, endDate = '', poolType = 'A', userName = '', sheetName = 'PGM' }) =>
  gasGet(OPS_GAS_URL, { action: 'syncSheetToOps', startDate, endDate, poolType, userName, sheetName })
