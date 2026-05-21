import { findBestPerf } from '../../hooks/usePerformanceMap'

export default function ProductTooltip({ item, perfMap }) {
  const lastPerf = findBestPerf(perfMap, item.dealType, item.pgmCodeName)

  const rows = [
    ['신상품구분',  item.newProductType || '-'],
    ['거래형태',    item.dealType || '-'],
    ['메인가격',    item.mainPrice ? Number(item.mainPrice).toLocaleString() + '원' : '-'],
    ['정액비',      item.fixedFee ? Number(item.fixedFee).toLocaleString() + '원' : '-'],
    ['희망시간대',  item.preferredTime || '-'],
    ['가용가중분1', item.availableWeightedMin1 ? item.availableWeightedMin1 + '분' : '-'],
    ['가용가중분2', item.availableWeightedMin2 ? item.availableWeightedMin2 + '분' : '-'],
    ['잔여편성',    item.remainingSchedule || '-'],
    ['기타요청',    item.requestNote || '-'],
  ]

  const perfRows = lastPerf ? [
    ['직전방송',     `${lastPerf.broadcastDate} ${lastPerf.broadcastTime}`],
    ['분당취급액',   lastPerf.salesPerWeightedMin  ? Number(lastPerf.salesPerWeightedMin).toLocaleString()  : '-'],
    ['분당한계이익', lastPerf.profitPerWeightedMin ? Number(lastPerf.profitPerWeightedMin).toLocaleString() : '-'],
  ] : []

  return (
    <div style={{
      position: 'absolute', right: '105%', top: 0, zIndex: 999,
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 8, padding: '10px 12px', minWidth: 220, maxWidth: 280,
      boxShadow: '0 4px 16px rgba(0,0,0,.2)', pointerEvents: 'none'
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
        {item.pgmCodeName}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: perfRows.length ? 8 : 0 }}>
        {rows.map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
            <span style={{ color: 'var(--text3)', minWidth: 64, flexShrink: 0 }}>{label}</span>
            <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{val}</span>
          </div>
        ))}
      </div>
      {perfRows.length > 0 && (
        <>
          <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>직전 실적</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {perfRows.map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                <span style={{ color: 'var(--text3)', minWidth: 64, flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}