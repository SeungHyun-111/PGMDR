const SOURCE = 'https://script.google.com/macros/s/AKfycbzE147wQl7Qiz59QEB-vxEppregg32FbZRCqSHqmaK8_8OiMpPnu-S_znUeyORt59gd/exec'

function fetchSource(month) {
  return new Promise((resolve, reject) => {
    const callback = `__pgmdrCompetitor_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const script = document.createElement('script')
    const cleanup = () => { clearTimeout(timeout); delete window[callback]; script.remove() }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('원본 응답 시간이 초과되었습니다. 다시 시도해주세요.')) }, 120000)
    window[callback] = result => {
      cleanup()
      if (!result?.ok || !result.payload) reject(new Error(result?.error || '원본 데이터가 없습니다.'))
      else resolve(result.payload)
    }
    script.onerror = () => { cleanup(); reject(new Error('경쟁사 원본을 불러오지 못했습니다.')) }
    script.src = `${SOURCE}?${new URLSearchParams({ month, callback })}`
    document.body.appendChild(script)
  })
}

export async function refreshCompetitorRtdb(month, onProgress) {
  if (!/^\d{4}(0[1-9]|1[0-2])$/.test(month)) throw new Error('갱신할 월을 선택해주세요.')
  onProgress('원본 데이터를 불러오는 중…')
  let payload = await fetchSource(month)
  onProgress('검색 인덱스 생성 및 RTDB 저장 중…')
  const worker = new Worker(new URL('./competitorRefresh.worker.js', import.meta.url), { type: 'module' })
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => data.ok ? resolve(data.counts) : reject(new Error(data.error))
      worker.onerror = () => reject(new Error('데이터 갱신 처리에 실패했습니다.'))
      worker.postMessage({ month, payload })
      payload = null
    })
  } finally {
    worker.terminate()
  }
}
