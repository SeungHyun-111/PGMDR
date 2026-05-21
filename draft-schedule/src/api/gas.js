const GAS_URL = 'https://script.google.com/macros/s/AKfycbzO12T4ND-TfI2BV-vICQO0qAEcsjlVgKQdAabZ41-aY4sh5rnUg-eqD9nVyWZG7C3A/exec'

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
  if (!json.success) throw new Error(json.error || 'GAS 호출 실패')
  return json.data
}

export async function fetchProposalRows(startDate, poolType = 'A') {
  const data = await fetchInitData(startDate, poolType)
  return data.proposalRows || []
}