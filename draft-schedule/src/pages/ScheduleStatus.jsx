import { useMemo, useState, useEffect } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { db, ref, get } from '../api/firebase'
import StatusScheduled from '../components/status/StatusScheduled'
import StatusUnscheduled from '../components/status/StatusUnscheduled'
import StatusLogs from '../components/status/StatusLogs'

export default function ScheduleStatus() {
  const { scheduleBlocks, proposalItems, performanceRows, startDate, poolType } = useScheduleStore()
  const [activeTab, setActiveTab] = useState('scheduled')
  const [filters, setFilters] = useState({ team: '', channel: '', category: '', date: '', org: '' })
  const [logs, setLogs] = useState([])
  const [logsLoaded, setLogsLoaded] = useState(false)

  const categoryMap = useCategoryMap(proposalItems, performanceRows)

  const scheduledBlocks = useMemo(() => {
    return Object.values(scheduleBlocks)
      .filter(b => b && !b.isDefault)
      .map(b => ({ ...b, category: categoryMap[b.pgmCodeName] || '미입력' }))
      .sort((a, b) => a.dateKey !== b.dateKey ? a.dateKey.localeCompare(b.dateKey) : (a.timeText || '').localeCompare(b.timeText || ''))
  }, [scheduleBlocks, categoryMap])

  const unscheduledItems = useMemo(() => {
    return proposalItems.map(item => ({ ...item, category: item.mdCategory || categoryMap[item.pgmCodeName] || '미입력' }))
  }, [proposalItems, categoryMap])

  const filterOptions = useMemo(() => ({
    teams:    [...new Set(scheduledBlocks.map(b => b.mdTeam || b.orgName).filter(Boolean))].sort(),
    orgs:     [...new Set(scheduledBlocks.map(b => b.orgName).filter(Boolean))].sort(),
    channels: [...new Set(scheduledBlocks.map(b => b.channel).filter(Boolean))].sort(),
    cats:     [...new Set(scheduledBlocks.map(b => b.category).filter(Boolean))].sort(),
    dates:    [...new Set(scheduledBlocks.map(b => b.dateKey).filter(Boolean))].sort(),
  }), [scheduledBlocks])

  const applyFilters = (items) => items.filter(item => {
    if (filters.team     && (item.mdTeam || item.orgName) !== filters.team)    return false
    if (filters.org      && item.orgName !== filters.org)                       return false
    if (filters.channel  && item.channel !== filters.channel)                   return false
    if (filters.category && item.category !== filters.category)                 return false
    if (filters.date     && item.dateKey !== filters.date)                      return false
    return true
  })

  useEffect(() => {
    if (activeTab !== 'logs' || logsLoaded || !startDate) return
    const weekKey = `${startDate}_${poolType}`
    get(ref(db, `sessions/${weekKey}/logs`)).then(snap => {
      if (snap.exists()) {
        setLogs(Object.values(snap.val()).sort((a, b) => b.timestamp - a.timestamp))
      }
      setLogsLoaded(true)
    })
  }, [activeTab, logsLoaded, startDate, poolType])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[
          { label: '편성 완료', value: scheduledBlocks.filter(b => !b.isCompeting && !b.isPreSchedule).length, color: 'var(--green)' },
          { label: '선편성',   value: scheduledBlocks.filter(b => b.isPreSchedule).length,                     color: 'var(--text2)' },
          { label: '경쟁 중',  value: scheduledBlocks.filter(b => b.isCompeting).length,                       color: 'var(--red)' },
          { label: '미편성',   value: unscheduledItems.length,                                                  color: 'var(--yellow)' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)', minWidth: 120 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6, fontWeight: 600, letterSpacing: '.4px' }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { id: 'scheduled',   label: `편성완료 (${scheduledBlocks.length})` },
          { id: 'unscheduled', label: `미편성 (${unscheduledItems.length})` },
          { id: 'logs',        label: '수정 로그' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid',
            borderColor: activeTab === tab.id ? 'var(--accent)' : 'var(--border)',
            background: activeTab === tab.id ? 'var(--accent)' : 'var(--bg2)',
            color: activeTab === tab.id ? '#fff' : 'var(--text2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* 필터 (로그 탭 제외) */}
      {activeTab !== 'logs' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'team',     label: '팀',      options: filterOptions.teams },
            { key: 'org',      label: '조직',    options: filterOptions.orgs },
            { key: 'channel',  label: '채널',    options: filterOptions.channels },
            { key: 'category', label: '카테고리', options: filterOptions.cats },
            { key: 'date',     label: '날짜',    options: filterOptions.dates },
          ].map(f => (
            <select key={f.key} value={filters[f.key]}
              onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: 6, fontSize: 11 }}>
              <option value="">전체 {f.label}</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ team: '', channel: '', category: '', date: '', org: '' })}
              style={{ padding: '5px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}>
              필터 초기화
            </button>
          )}
        </div>
      )}

      {activeTab === 'scheduled'   && <StatusScheduled blocks={applyFilters(scheduledBlocks)} />}
      {activeTab === 'unscheduled' && <StatusUnscheduled items={applyFilters(unscheduledItems)} />}
      {activeTab === 'logs'        && <StatusLogs logs={logs} />}
    </div>
  )
}