const formatTs = (ts) => {
  const d = new Date(ts)
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
}

export default function StatusLogs({ logs }) {
  if (logs.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>수정 로그가 없습니다.</div>
  )
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
            {['시각','작업자','액션','날짜','시간','편성코드명'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
              <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11, whiteSpace: 'nowrap' }}>{formatTs(log.timestamp)}</td>
              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{log.userName || '-'}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: log.action === '편성' ? '#f0fdf4' : log.action === '삭제' ? '#fef2f2' : '#eff6ff', color: log.action === '편성' ? 'var(--green)' : log.action === '삭제' ? 'var(--red)' : 'var(--accent)' }}>
                  {log.action}
                </span>
              </td>
              <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{log.dateKey || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{log.timeText || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.pgmCodeName || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}