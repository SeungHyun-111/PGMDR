export default function RatioTable({ data, groupDm = {}, stats, targetMap, totalSlotWeighted, totalTarget, showTarget, chartData, scheduledWeighted }) {
  const sorted = Object.entries(data).sort((a, b) => {
    if (a[0] === '편성팀') return 1
    if (b[0] === '편성팀') return -1
    if (a[0] === '미편성') return 1
    if (b[0] === '미편성') return -1
    return b[1] - a[1]
  })

  const getTeamColor = name => chartData?.find(d => d.name === name)?.color || 'var(--text3)'

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>구분</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>가중분</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>순수분</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>평균 가중률</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>비중</th>
            {showTarget && <>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>목표 가중분</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>목표 비중</th>
              <th style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>달성률</th>
            </>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(([name, weighted], i) => {
            const target = showTarget ? (targetMap[name] || 0) : 0
            const totalPct = stats.totalWeighted > 0 ? (weighted / stats.totalWeighted * 100) : 0
            const targetPct = totalSlotWeighted > 0 && target > 0 ? (target / totalSlotWeighted * 100) : 0
            const achievePct = target > 0 ? (weighted / target * 100) : null
            const isDefault = name === '편성팀'
            const isCompeting = name === '경쟁'
            const isUnscheduled = name === '미편성'
            const teamColor = getTeamColor(name)
            const dm = groupDm[name] || 0
            const avgRate = dm > 0 ? (weighted / dm * 100).toFixed(1) + '%' : '-'

            return (
              <tr key={name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!isDefault && !isCompeting && (
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor, flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 600, color: isCompeting ? 'var(--red)' : isDefault || isUnscheduled ? 'var(--text3)' : 'var(--text)' }}>
                      {name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: isDefault || isUnscheduled ? 'var(--text3)' : teamColor }}>
                  {Math.round(weighted).toLocaleString()}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>
                  {dm > 0 ? dm.toLocaleString() : '-'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text3)', fontSize: 11 }}>
                  {avgRate}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)', fontSize: 11 }}>
                  {totalPct.toFixed(1)}%
                </td>
                {showTarget && <>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>
                    {target > 0 ? Math.round(target).toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)', fontSize: 11 }}>
                    {targetPct > 0 ? targetPct.toFixed(1) + '%' : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', minWidth: 180 }}>
                    {achievePct !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(achievePct, 100)}%`, height: '100%', borderRadius: 3, background: achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : teamColor, transition: 'width .4s' }} />
                        </div>
                        <span style={{ fontSize: 11, minWidth: 40, textAlign: 'right', fontWeight: 700, color: achievePct >= 100 ? 'var(--green)' : achievePct >= 80 ? 'var(--yellow)' : 'var(--red)' }}>
                          {Math.round(achievePct)}%
                        </span>
                      </div>
                    ) : '-'}
                  </td>
                </>}
              </tr>
            )
          })}
          <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg3)' }}>
            <td style={{ padding: '10px 14px', fontWeight: 700 }}>합계</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{Math.round(stats.totalWeighted).toLocaleString()}</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>{(stats.totalDm || 0) > 0 ? stats.totalDm.toLocaleString() : '-'}</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)', fontSize: 11 }}>
              {(stats.totalDm || 0) > 0 ? (stats.totalWeighted / stats.totalDm * 100).toFixed(1) + '%' : '-'}
            </td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>100%</td>
            {showTarget && <>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>
                {totalTarget > 0 ? Math.round(totalTarget).toLocaleString() : '-'}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>
                {totalSlotWeighted > 0 && totalTarget > 0 ? (totalTarget / totalSlotWeighted * 100).toFixed(1) + '%' : '-'}
              </td>
              <td style={{ padding: '10px 14px', minWidth: 180 }}>
                {totalTarget > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((scheduledWeighted || 0) / totalTarget * 100, 100)}%`, height: '100%', borderRadius: 3, background: 'var(--accent)', transition: 'width .4s' }} />
                    </div>
                    <span style={{ fontSize: 11, minWidth: 40, textAlign: 'right', fontWeight: 700, color: (scheduledWeighted || 0) >= totalTarget ? 'var(--green)' : 'var(--yellow)' }}>
                      {Math.round((scheduledWeighted || 0) / totalTarget * 100)}%
                    </span>
                  </div>
                )}
              </td>
            </>}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
