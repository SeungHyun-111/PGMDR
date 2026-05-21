// src/components/modal/BlockPerfSection.jsx  ← 신규 분리
import { DEAL_TYPES } from '../../constants/dealTypes'

export default function BlockPerfSection({ lastPerf, manualSales, setManualSales, manualProfit, setManualProfit, inp }) {
  const fmt = v => Number(v || 0).toLocaleString()
  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
        직전 실적
        {lastPerf
          ? <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>({lastPerf.broadcastDate} {lastPerf.broadcastTime})</span>
          : <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>— 매칭 없음</span>
        }
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>취급/분</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{fmt(lastPerf?.salesPerWeightedMin)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>한익/분</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmt(lastPerf?.profitPerWeightedMin)}</div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>수동 입력 (비워두면 직전 실적 사용)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>수동 취급/분</label>
            <input type="number" value={manualSales} onChange={e => setManualSales(e.target.value)}
              placeholder={fmt(lastPerf?.salesPerWeightedMin)} style={inp} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>수동 한익/분</label>
            <input type="number" value={manualProfit} onChange={e => setManualProfit(e.target.value)}
              placeholder={fmt(lastPerf?.profitPerWeightedMin)} style={inp} />
          </div>
        </div>
      </div>
    </div>
  )
}