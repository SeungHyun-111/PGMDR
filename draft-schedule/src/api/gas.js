const GAS_URL = 'https://script.google.com/macros/s/AKfycbzaGlpoXio4K9wr5G1D8nxUCbxZk2xGJa2DCrzHFy-QxkCLzkWt0j_e4Ik9jzMWUloC/exec'

async function gasGet(params) {
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`${GAS_URL}?${qs}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'GAS 호출 실패')
  return json.data
}

export const fetchInitData            = (startDate, poolType = 'A') => gasGet({ action: 'init',               startDate, poolType })
export const fetchRefreshPerformance  = ()                           => gasGet({ action: 'refreshPerformance'                      })
export const fetchRefreshProposals    = (poolType = 'A')             => gasGet({ action: 'refreshProposals',   poolType            })
export const fetchRefreshPreSchedule  = ()                           => gasGet({ action: 'refreshPreSchedule'                      })
