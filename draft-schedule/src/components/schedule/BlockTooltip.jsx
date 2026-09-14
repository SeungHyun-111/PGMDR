import { getCompetitionItems } from '../../utils/competition'

export default function BlockTooltip({ block, lastPerf, sameBroadcastPerf, manual, pos, competitionItems }) {
  // 화면 오른쪽/아래 잘림 방지
  const tooltipW = 230
  const gap = 8
  const margin = 8
  const hasManual = manual && (manual.expectedSalesPerWeightedMin != null || manual.expectedProfitPerWeightedMin != null)
  const compItems = competitionItems || getCompetitionItems(block)
  const perfSectionCount = [sameBroadcastPerf, hasManual, lastPerf].filter(Boolean).length
  const approxH  = block.isCompeting ? Math.min(360, 60 + compItems.length * 62) : (block.annotation ? 290 : 220) + (perfSectionCount * 60)
  const viewportW = window.innerWidth || 0
  const viewportH = window.innerHeight || 0
  const preferRight = (pos.right || 0) + gap + tooltipW <= viewportW - margin
  const rawLeft = preferRight
    ? (pos.right || 0) + gap
    : (pos.left || 0) - tooltipW - gap
  const left = Math.max(margin, Math.min(rawLeft, viewportW - tooltipW - margin))
  const belowTop = pos.top || 0
  const aboveTop = (pos.top || 0) - approxH - gap
  const rawTop = belowTop + approxH <= viewportH - margin
    ? belowTop
    : aboveTop >= margin
      ? aboveTop
      : viewportH - approxH - margin
  const top = Math.max(margin, Math.min(rawTop, viewportH - approxH - margin))

  const rows = [
    ['팀',       block.mdTeam || block.orgName || '-'],
    ['채널',     block.channel || '-'],
    ['거래형태', block.dealType || '-'],
    ['신상품구분', block.newProductType || '-'],
    ['카테고리', block.mdCategory || '-'],
    ['방송일시', `${block.dateKey} ${block.timeText}`],
    ['방송시간', `${block.durationMin}분`],
    ['가중분',   block.weightedMin || '-'],
    ['메모코드', block.memoCode || '-'],
    ['메모코드2', block.memoCode2 || '-'],
    ['편성C',    block.scheduleComment || '-'],
    ['기타요청', block.requestNote || '-'],
    ...(block.annotation ? [['첨삭', block.annotation]] : []),
  ]

  return (
    <div style={{ position: 'fixed', left, top, zIndex: 9999, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, padding: '8px 10px', minWidth: tooltipW, maxWidth: 300, boxShadow: '0 4px 16px rgba(0,0,0,.3)', pointerEvents: 'none' }}>
      {block.isCompeting ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚔ 경쟁 중</div>
          {compItems.map((item, i) => (
            <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? 'var(--ca-t)' : 'var(--ip-t)', marginBottom: 3 }}>{i === 0 ? '● 기존' : '● 신규'}</div>
              {[['상품', item.pgmCodeName], ['팀', item.mdTeam || '-'], ['거래형태', item.dealType || '-']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 46 }}>{l}</span>
                  <span style={{ color: 'var(--text)' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          {rows.map(([label, val]) => (
            <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
              <span style={{ color: label === '첨삭' ? 'var(--yellow)' : 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{val}</span>
            </div>
          ))}
          {sameBroadcastPerf && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>해당PGM실적 ({sameBroadcastPerf.broadcastDate} {sameBroadcastPerf.broadcastTime || ''})</div>
              {[
                ['취급/분', Number(sameBroadcastPerf.salesPerWeightedMin  || 0).toLocaleString(), 'var(--accent)'],
                ['한익/분', Number(sameBroadcastPerf.profitPerWeightedMin || 0).toLocaleString(), 'var(--green)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </>
          )}
          {hasManual && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>수기실적</div>
              {[
                ['취급/분', manual.expectedSalesPerWeightedMin,  'var(--accent)'],
                ['한익/분', manual.expectedProfitPerWeightedMin, 'var(--green)'],
              ].filter(([, v]) => v != null).map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{Number(val).toLocaleString()}</span>
                </div>
              ))}
            </>
          )}
          {lastPerf && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>직전실적 ({lastPerf.broadcastDate} {lastPerf.broadcastTime || ''})</div>
              {[
                ['취급/분', Number(lastPerf.salesPerWeightedMin  || 0).toLocaleString(), 'var(--accent)'],
                ['한익/분', Number(lastPerf.profitPerWeightedMin || 0).toLocaleString(), 'var(--green)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: 'var(--text3)', minWidth: 52, flexShrink: 0 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
