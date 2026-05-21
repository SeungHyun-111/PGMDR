import useScheduleStore from '../../store/useScheduleStore'

export default function StatusScheduled({ rows }) {
  const { starred, toggleStarred } = useScheduleStore()

  if (!rows || rows.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>편성된 항목이 없습니다.</div>
  )

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
            {['★','날짜','시간','채널','조직','팀','카테고리','편성코드명','가중분','메모코드','편성C','상태'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((block, i) => {
            const isStarred = !!starred[block.itemId]
            return (
              <tr key={block.blockKey || i} style={{ borderBottom: '1px solid var(--border)', background: isStarred ? 'rgba(245,200,66,.04)' : i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <button onClick={() => block.itemId && toggleStarred(block.itemId)}
                    style={{ background: 'transparent', border: 'none', cursor: block.itemId ? 'pointer' : 'default', fontSize: 12, color: isStarred ? 'var(--yellow)' : 'var(--border2)' }}>
                    {isStarred ? '★' : '☆'}
                  </button>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{block.dateKey}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{block.timeText}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                    background: block.channel === 'CA' ? 'var(--ca)' : block.channel === 'IP' ? 'var(--ip)' : 'var(--all)',
                    color: block.channel === 'CA' ? 'var(--ca-t)' : block.channel === 'IP' ? 'var(--ip-t)' : 'var(--all-t)' }}>
                    {block.channel}
                  </span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--text2)', fontSize: 11 }}>{block.orgName || '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{block.mdTeam || '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.mdCategory || '-'}</td>
                <td style={{ padding: '8px 12px', fontWeight: block.isCompeting ? 700 : 400, color: block.isCompeting ? 'var(--red)' : 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.isCompeting ? '⚔ ' : ''}{block.pgmCodeName}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{(block.weightedMin || 0).toLocaleString()}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{block.memoCode || '-'}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.scheduleComment || '-'}</td>
                <td style={{ padding: '8px 12px' }}>
                  {block.isCompeting ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef2f2', color: 'var(--red)', fontWeight: 700 }}>경쟁</span>
                  ) : block.isPreSchedule ? (
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--text3)', fontWeight: 700 }}>선편성</span>
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
}