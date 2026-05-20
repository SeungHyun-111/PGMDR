import { useMemo, useState } from 'react'
import useScheduleStore from '../store/useScheduleStore'

export default function ScheduleStatus() {
  const { scheduleBlocks, pgmSlots, proposalItems, performanceRows } = useScheduleStore()
  const [activeTab, setActiveTab] = useState('scheduled')
  const [filters, setFilters] = useState({ team: '', channel: '', category: '', date: '' })

  // 카테고리 맵
  const categoryMap = useMemo(() => {
    const map = {}
    proposalItems.forEach(item => {
      if (item.pgmCodeName) map[item.pgmCodeName] = item.mdCategory || null
    })
    performanceRows.forEach(perf => {
      if (perf.pgmCodeName && !map[perf.pgmCodeName]) map[perf.pgmCodeName] = perf.category || null
    })
    return map
  }, [proposalItems, performanceRows])

  // 편성된 블록 목록
  const scheduledBlocks = useMemo(() => {
    return Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault)
      .map(b => ({ ...b, category: categoryMap[b.pgmCodeName] || '미입력' }))
      .sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
        return (a.timeText || '').localeCompare(b.timeText || '')
      })
  }, [scheduleBlocks, categoryMap])

  // 미편성 목록 (사이드바 잔여)
  const unscheduledItems = useMemo(() => {
    return proposalItems.map(item => ({
      ...item,
      category: item.mdCategory || categoryMap[item.pgmCodeName] || '미입력'
    }))
  }, [proposalItems, categoryMap])

  // 필터 옵션 (데이터 드리븐)
  const filterOptions = useMemo(() => {
    const teams = [...new Set(scheduledBlocks.map(b => b.mdTeam || b.orgName).filter(Boolean))].sort()
    const channels = [...new Set(scheduledBlocks.map(b => b.channel).filter(Boolean))].sort()
    const categories = [...new Set(scheduledBlocks.map(b => b.category).filter(Boolean))].sort()
    const dates = [...new Set(scheduledBlocks.map(b => b.dateKey).filter(Boolean))].sort()
    return { teams, channels, categories, dates }
  }, [scheduledBlocks])

  // 필터 적용
  const applyFilters = (items) => {
    return items.filter(item => {
      if (filters.team && (item.mdTeam || item.orgName) !== filters.team) return false
      if (filters.channel && item.channel !== filters.channel) return false
      if (filters.category && item.category !== filters.category) return false
      if (filters.date && item.dateKey !== filters.date) return false
      return true
    })
  }

  const filteredScheduled = applyFilters(scheduledBlocks)
  const filteredUnscheduled = applyFilters(unscheduledItems)

  const sel = (key, val) => ({ target: { value: v } }) => setFilters(f => ({ ...f, [key]: v === f[key] ? '' : v }))

  const renderFilters = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {[
        { key: 'team', label: '팀', options: filterOptions.teams },
        { key: 'channel', label: '채널', options: filterOptions.channels },
        { key: 'category', label: '카테고리', options: filterOptions.categories },
        { key: 'date', label: '날짜', options: filterOptions.dates },
      ].map(f => (
        <select
          key={f.key}
          value={filters[f.key]}
          onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
        >
          <option value="">전체 {f.label}</option>
          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => setFilters({ team: '', channel: '', category: '', date: '' })}
          style={{ padding: '5px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}
        >
          필터 초기화
        </button>
      )}
    </div>
  )

  const renderScheduledTable = () => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            {['날짜', '시간', '채널', '팀', '카테고리', '편성코드명', '가중분', '메모코드', '편성C', '상태'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredScheduled.length === 0 ? (
            <tr><td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>편성된 항목이 없습니다.</td></tr>
          ) : filteredScheduled.map((block, i) => {
            const isCompeting = block.isCompeting
            const isPreSchedule = block.isPreSchedule
            return (
              <tr key={block.blockKey || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.dateKey}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{block.timeText}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                    background: block.channel === 'CA' ? 'var(--ca)' : block.channel === 'IP' ? 'var(--ip)' : 'var(--all)',
                    color: block.channel === 'CA' ? 'var(--ca-t)' : block.channel === 'IP' ? 'var(--ip-t)' : 'var(--all-t)'
                  }}>
                    {block.channel}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.mdTeam || block.orgName || '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.category}</td>
                <td style={{ padding: '8px 12px', fontWeight: isCompeting ? 700 : 400, color: isCompeting ? 'var(--red)' : 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isCompeting ? '⚔ ' : ''}{block.pgmCodeName}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{(block.weightedMin || 0).toLocaleString()}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.memoCode || '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.scheduleComment || '-'}</td>
                <td style={{ padding: '8px 12px' }}>
                  {isCompeting ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: 'var(--red)', fontWeight: 700 }}>경쟁</span>
                  ) : isPreSchedule ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 700 }}>선편성</span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f0fdf4', color: 'var(--green)', fontWeight: 700 }}>편성</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  const renderUnscheduledTable = () => (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            {['팀', '카테고리', '편성코드명', '거래형태', '신상품', '가용가중분', '잔여편성'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredUnscheduled.length === 0 ? (
            <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>미편성 항목이 없습니다.</td></tr>
          ) : filteredUnscheduled.map((item, i) => (
            <tr key={item.itemId || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
              <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.mdTeam || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{item.category}</td>
              <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pgmCodeName || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{item.dealType || '-'}</td>
              <td style={{ padding: '8px 12px' }}>
                {item.newProductType ? (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef9c3', color: '#854d0e', fontWeight: 700 }}>{item.newProductType}</span>
                ) : '-'}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{(item.availableWeightedMin1 || 0).toLocaleString()}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)' }}>{item.remainingSchedule || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>

      {/* 상단 요약 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: '편성 완료', value: scheduledBlocks.filter(b => !b.isCompeting).length, color: 'var(--green)' },
          { label: '경쟁 중', value: scheduledBlocks.filter(b => b.isCompeting).length, color: 'var(--red)' },
          { label: '선편성', value: scheduledBlocks.filter(b => b.isPreSchedule).length, color: 'var(--text2)' },
          { label: '미편성', value: unscheduledItems.length, color: 'var(--yellow)' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { id: 'scheduled', label: `편성완료 (${scheduledBlocks.length})` },
          { id: 'unscheduled', label: `미편성 (${unscheduledItems.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid',
            borderColor: activeTab === tab.id ? 'var(--accent)' : 'var(--border)',
            background: activeTab === tab.id ? 'var(--accent)' : 'var(--bg2)',
            color: activeTab === tab.id ? '#fff' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {renderFilters()}

      {activeTab === 'scheduled' && renderScheduledTable()}
      {activeTab === 'unscheduled' && renderUnscheduledTable()}
    </div>
  )
}