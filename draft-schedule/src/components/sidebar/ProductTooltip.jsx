import { getLastPerf } from '../../utils/entityKey'

export default function ProductTooltip({ item, perfMap, entityProps, pos }) {
  const lastPerf = getLastPerf(item, entityProps, perfMap)

  const rows = [
    ['신상품구분',  item.newProductType || '-'],
    ['거래형태',    item.dealTypeConverted || '-'],
    ['메인가격',    item.mainPrice ? Number(item.mainPrice).toLocaleString() + '원' : '-'],
    ['정액비',      item.fixedFee  ? Number(item.fixedFee).toLocaleString()  + '원' : '-'],
    ['희망시간대',  item.preferredTime || '-'],
    ['가용가중분1', item.availableWeightedMin1 ? item.availableWeightedMin1 + '분' : '-'],
    ['가용가중분2', item.availableWeightedMin2 ? item.availableWeightedMin2 + '분' : '-'],
    ['잔여편성',    item.remainingSchedule || '-'],
    ['메모코드',    item.memoCode || '-'],
    ['메모코드2',   item.memoCode2 || '-'],
    ['편성C',       item.scheduleComment || '-'],
    ['기타요청',    item.requestNote || '-'],
  ]

  const tooltipW = 260
  const approxH  = 340
  const left = pos ? (pos.x - tooltipW - 8 < 0 ? pos.x + 8 : pos.x - tooltipW - 8) : 0
  const top  = pos ? Math.min(pos.y, window.innerHeight - approxH - 8) : 0

  const perfRows = [
    ['직전방송', lastPerf ? `${lastPerf.broadcastDate} ${lastPerf.broadcastTime}` : '-'],
    ['취급/분',  lastPerf ? Number(lastPerf.salesPerWeightedMin  || 0).toLocaleString() : '-'],
    ['한익/분',  lastPerf ? Number(lastPerf.profitPerWeightedMin || 0).toLocaleString() : '-'],
  ]

  return (
    <div style={{ position: 'fixed', left, top, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', width: tooltipW, boxShadow: '0 4px 16px rgba(0,0,0,.2)', pointerEvents: 'none' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 8, lineHeight: 1.3 }}>
        {item.pgmCodeName}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
        {rows.map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
            <span style={{ color: 'var(--text3)', minWidth: 64, flexShrink: 0 }}>{label}</span>
            <span style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{val}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)' }}>직전 실적</span>
        {!lastPerf && <span style={{ fontSize: 9, color: 'var(--text3)' }}>실적 없음</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {perfRows.map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
            <span style={{ color: 'var(--text3)', minWidth: 64, flexShrink: 0 }}>{label}</span>
            <span style={{ color: lastPerf ? 'var(--accent)' : 'var(--text3)', fontWeight: lastPerf ? 600 : 400 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
