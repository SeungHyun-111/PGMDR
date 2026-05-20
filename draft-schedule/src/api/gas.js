const GAS_URL = 'https://script.google.com/macros/s/AKfycbxtCcY6a0PpjYZeUN3eTl45qQ28HIuPHRQspVpdh5xidSgEPbHura3nVXbFRKRAeJHo/exec'

export async function fetchInitData(startDate, poolType = 'A') {
  const url = `${GAS_URL}?action=init&startDate=${startDate}&poolType=${poolType}`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'GAS 호출 실패')
  return json.data
}

export async function fetchRefreshPerformance() {
  const url = `${GAS_URL}?action=refreshPerformance`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || '실적 갱신 실패')
  return json.data.performanceRows
}