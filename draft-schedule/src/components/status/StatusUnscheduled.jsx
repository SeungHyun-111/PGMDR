export default function StatusUnscheduled({ items }) {
  if (items.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>미편성 항목이 없습니다.</div>
  )
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '2px solid var(--border)' }}>
            {['팀','카테고리','편성코드명','거래형태','신상품','가용가중분','잔여편성'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.itemId || i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
              <td style={{ padding: '8px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.mdTeam || '-'}</td>
              <td style={{ padding: '8px 12px', color: 'var(--text3)', fontSize: 11 }}>{item.category}</td>
              <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.pgmCodeName || '-'}</td>
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
}