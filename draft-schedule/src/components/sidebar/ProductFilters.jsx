import useFilterOptions from '../../hooks/useFilterOptions'
import useScheduleStore from '../../store/useScheduleStore'

export default function ProductFilters({ filters, setFilters }) {
  const { proposalItems } = useScheduleStore()
  const { teams, dealTypes, newTypes, videoStatuses } = useFilterOptions(proposalItems)

  const sel = (key, val) => setFilters(prev => ({ ...prev, [key]: val }))

  const selectStyle = {
    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10, cursor: 'pointer'
  }

  const sortBtn = (dir, label) => {
    const active = filters.sort === dir
    return (
      <button
        onClick={() => sel('sort', active ? 'none' : dir)}
        style={{ ...selectStyle, flex: 'none', padding: '4px 7px', background: active ? 'var(--accent)' : 'var(--bg3)', color: active ? '#fff' : 'var(--text3)', fontWeight: active ? 700 : 400 }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
      <input
        placeholder="🔍 상품명 / 편성코드 검색"
        value={filters.keyword}
        onChange={e => sel('keyword', e.target.value)}
        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11 }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <select value={filters.team} onChange={e => sel('team', e.target.value)} style={selectStyle}>
          <option value="전체">전체 팀</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.dealType} onChange={e => sel('dealType', e.target.value)} style={selectStyle}>
          <option value="전체">거래형태</option>
          {dealTypes.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <select value={filters.newProductType} onChange={e => sel('newProductType', e.target.value)} style={selectStyle}>
          <option value="전체">신상품구분</option>
          {newTypes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filters.videoStatus} onChange={e => sel('videoStatus', e.target.value)} style={selectStyle}>
          <option value="전체">영상구분</option>
          {videoStatuses.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <button onClick={() => sel('starOnly', !filters.starOnly)}
          style={{ ...selectStyle, flex: 'none', padding: '4px 8px', background: filters.starOnly ? 'var(--yellow)' : 'var(--bg3)', color: filters.starOnly ? '#fff' : 'var(--text3)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}>
          ★
        </button>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0 }}>정렬</span>
        {sortBtn('asc', '가나다↑')}
        {sortBtn('desc', '가나다↓')}
      </div>
    </div>
  )
}