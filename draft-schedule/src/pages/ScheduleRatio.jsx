import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'

export default function ScheduleRatio() {
  const { scheduleBlocks, pgmSlots, targetMetrics, proposalItems, performanceRows } = useScheduleStore()
  const [viewMode, setViewMode] = useState('team') // team | category | channel

  // 카테고리 맵핑 (proposalItems → 실적DB 순으로 맵핑)
  const categoryMap = useMemo(() => {
    const map = {}
    proposalItems.forEach(item => {
      if (item.pgmCodeName) {
        map[item.pgmCodeName] = item.mdCategory || null
      }
    })
    // 실적DB에서 카테고리 보완
    performanceRows.forEach(perf => {
      if (perf.pgmCodeName && !map[perf.pgmCodeName]) {
        map[perf.pgmCodeName] = perf.category || null
      }
    })
    return map
  }, [proposalItems, performanceRows])

  // scheduleBlocks 집계
  const stats = useMemo(() => {
    const team = {}
    const category = {}
    const channel = { CA: 0, IP: 0, ALL: 0, 경쟁: 0 }
    let totalWeighted = 0
    let competingWeighted = 0

    Object.values(scheduleBlocks).forEach(block => {
      if (!block || block.isDefault) return

      const w = block.weightedMin || 0
      totalWeighted += w

      if (block.isCompeting) {
        channel['경쟁'] = (channel['경쟁'] || 0) + w
        competingWeighted += w
        // 팀별 경쟁 집계
        const t = '경쟁'
        team[t] = (team[t] || 0) + w
        category['경쟁'] = (category['경쟁'] || 0) + w
        return
      }

      // 채널
      const ch = block.channel || 'ALL'
      channel[ch] = (channel[ch] || 0) + w

      // 팀
      const t = block.mdTeam || block.orgName || '미지정'
      team[t] = (team[t] || 0) + w

      // 카테고리
      const cat = categoryMap[block.pgmCodeName] || '미입력'
      category[cat] = (category[cat] || 0) + w
    })

    return { team, category, channel, totalWeighted, competingWeighted }
  }, [scheduleBlocks, categoryMap])

  // 목표 데이터 (targetMetrics에서 팀별 가중분 목표)
  const targetMap = useMemo(() => {
    if (!targetMetrics) return {}
    const map = {}
    const salesData = targetMetrics.sales || []
    salesData.forEach(item => {
      if (item.name && !item.isCompanyTotal) {
        map[item.name] = item.value || 0
      }
    })
    return map
  }, [targetMetrics])

  // 전체 목표 가중분
  const totalTarget = useMemo(() => {
    if (!targetMetrics) return 0
    const total = (targetMetrics.sales || []).find(x => x.isCompanyTotal)
    return total?.value || 0
  }, [targetMetrics])

  const renderBar = (value, target, color) => {
    const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
    const over = target > 0 && value > target
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        <div style={{ flex: 1, height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: over ? 'var(--red)' : color, borderRadius: 4, transition: 'width .4s' }} />
        </div>
        <span style={{ fontSize: 10, color: over ? 'var(--red)' : 'var(--text2)', minWidth: 36, textAlign: 'right', fontWeight: over ? 700 : 400 }}>
          {Math.round(pct)}%
        </span>
      </div>
    )
  }

  const renderTable = (data, targetData) => {
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1])
    return (
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              {['구분', '편성 가중분', '목표 가중분', '달성률', '비중'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: h === '구분' ? 'left' : 'right', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(([name, weighted], i) => {
              const target = targetData?.[name] || 0
              const pct = target > 0 ? Math.round((weighted / target) * 100) : null
              const totalPct = stats.totalWeighted > 0 ? Math.round((weighted / stats.totalWeighted) * 100) : 0
              const isCompeting = name === '경쟁'
              return (
                <tr key={name} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: isCompeting ? 'var(--red)' : 'var(--text)' }}>
                    {isCompeting ? '⚔ ' : ''}{name}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                    {weighted.toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>
                    {target > 0 ? target.toLocaleString() : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {pct != null ? (
                      <span style={{ color: pct >= 100 ? 'var(--green)' : pct >= 80 ? 'var(--yellow)' : 'var(--red)', fontWeight: 700 }}>
                        {pct}%
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>
                    {totalPct}%
                  </td>
                </tr>
              )
            })}
            {/* 합계 */}
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg3)', fontWeight: 700 }}>
              <td style={{ padding: '10px 14px', color: 'var(--text)' }}>합계</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--accent)' }}>{stats.totalWeighted.toLocaleString()}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>{totalTarget > 0 ? totalTarget.toLocaleString() : '-'}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                {totalTarget > 0 ? (
                  <span style={{ color: stats.totalWeighted >= totalTarget ? 'var(--green)' : 'var(--yellow)', fontWeight: 700 }}>
                    {Math.round((stats.totalWeighted / totalTarget) * 100)}%
                  </span>
                ) : '-'}
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text2)' }}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>

      {/* 상단 요약 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: '총 편성 가중분', value: stats.totalWeighted.toLocaleString(), color: 'var(--accent)' },
          { label: '목표 가중분', value: totalTarget > 0 ? totalTarget.toLocaleString() : '-', color: 'var(--text2)' },
          { label: '달성률', value: totalTarget > 0 ? `${Math.round((stats.totalWeighted / totalTarget) * 100)}%` : '-', color: stats.totalWeighted >= totalTarget ? 'var(--green)' : 'var(--yellow)' },
          { label: '경쟁 가중분', value: stats.competingWeighted.toLocaleString(), color: 'var(--red)' },
          { label: '편성 슬롯', value: Object.values(scheduleBlocks).filter(b => b && !b.isDefault).length, color: 'var(--text)' },
          { label: '디폴트 슬롯', value: Object.values(scheduleBlocks).filter(b => b && b.isDefault).length, color: 'var(--text3)' },
        ].map(card => (
          <div key={card.label} style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 뷰 모드 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { id: 'team', label: '팀별' },
          { id: 'category', label: '카테고리별' },
          { id: 'channel', label: '채널별' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setViewMode(tab.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid',
            borderColor: viewMode === tab.id ? 'var(--accent)' : 'var(--border)',
            background: viewMode === tab.id ? 'var(--accent)' : 'var(--bg2)',
            color: viewMode === tab.id ? '#fff' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {viewMode === 'team' && renderTable(stats.team, targetMap)}
      {viewMode === 'category' && renderTable(stats.category, {})}
      {viewMode === 'channel' && renderTable(stats.channel, {})}

    </div>
  )
}