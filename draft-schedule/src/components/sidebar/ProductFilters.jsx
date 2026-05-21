import useFilterOptions from '../../hooks/useFilterOptions'
import useScheduleStore from '../../store/useScheduleStore'

export default function ProductFilters({ filters, onChange }) {
  const { proposalItems } = useScheduleStore()
  const { teams, dealTypes, newTypes } = useFilterOptions(proposalItems)

  const sel = (key, val) => onChange({ ...filters, [key]: val })

  const selectStyle = {
    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10, cursor: 'pointer'
  }

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
      {/* 검색 */}
      <input
        placeholder="🔍 상품명 / 편성코드 검색"
        value={filters.search}
        onChange={e => sel('search', e.target.value)}
        style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11 }}
      />
      {/* 팀 + 거래형태 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <select value={filters.team} onChange={e => sel('team', e.target.value)} style={selectStyle}>
          <option value="">전체 팀</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.dealType} onChange={e => sel('dealType', e.target.value)} style={selectStyle}>
          <option value="">거래형태</option>
          {dealTypes.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {/* 신상품 + 정렬 */}
      <div style={{ display: 'flex', gap: 4 }}>
        <select value={filters.newType} onChange={e => sel('newType', e.target.value)} style={selectStyle}>
          <option value="">신상품구분</option>
          {newTypes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={filters.sort} onChange={e => sel('sort', e.target.value)} style={selectStyle}>
          <option value="">정렬</option>
          <option value="perf_desc">실적 높은순</option>
          <option value="perf_asc">실적 낮은순</option>
          <option value="new_first">신상품 우선</option>
          <option value="remain_desc">잔여편성 많은순</option>
        </select>
      </div>
    </div>
  )
}