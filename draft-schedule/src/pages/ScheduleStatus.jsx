import { useMemo, useState, useEffect } from 'react'
import useScheduleStore from '../store/useScheduleStore'
import useCategoryMap from '../hooks/useCategoryMap'
import { db, ref, get } from '../api/firebase'
import StatusScheduled from '../components/status/StatusScheduled'
import StatusUnscheduled from '../components/status/StatusUnscheduled'
import StatusLogs from '../components/status/StatusLogs'

export default function ScheduleStatus() {
  const { scheduleBlocks, proposalItems, startDate, poolType } = useScheduleStore()
  const categoryMap = useCategoryMap(proposalItems)
  const [tab, setTab]   = useState('scheduled')
  const [logs, setLogs] = useState([])

  const enrichedBlocks = useMemo(() =>
    Object.values(scheduleBlocks).filter(b => !b.isDefault).map(block => ({
      ...block,
      mdCategory: block.mdCategory || categoryMap[block.pgmCodeName] || '미분류',
    }))
  , [scheduleBlocks, categoryMap])

  useEffect(() => {
    if (!startDate) return
    get(ref(db, `sessions/${startDate}_${poolType}/logs`)).then(snap => {
      const val = snap.val() || {}
      setLogs(Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    })
  }, [startDate, poolType])

  const btnStyle = active => ({
    padding: '6px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg3)',
    border: '1px solid var(--border)',
    color: active ? '#fff' : 'var(--text2)',
  })

  return (
    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button style={btnStyle(tab === 'scheduled')}   onClick={() => setTab('scheduled')}>편성완료 {enrichedBlocks.length}</button>
        <button style={btnStyle(tab === 'unscheduled')} onClick={() => setTab('unscheduled')}>미편성 {proposalItems.length}</button>
        <button style={btnStyle(tab === 'logs')}        onClick={() => setTab('logs')}>변경이력 {logs.length}</button>
      </div>
      {tab === 'scheduled'   && <StatusScheduled   rows={enrichedBlocks} />}
      {tab === 'unscheduled' && <StatusUnscheduled rows={proposalItems} />}
      {tab === 'logs'        && <StatusLogs        logs={logs} />}
    </div>
  )
}