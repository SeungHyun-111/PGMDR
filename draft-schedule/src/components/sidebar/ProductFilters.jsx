import { useMemo } from 'react'

export default function ProductFilters({ filters, onChange, items }) {

  const teams = useMemo(() => [...new Set(items.map(i => i.mdTeam).filter(Boolean))].sort(), [items])
  const dealTypes = useMemo(() => [...new Set(items.map(i => i.dealType).filter(Boolean))].sort(), [items])
  const newTypes = useMemo(() => [...new Set(items.map(i => i.newProductType).filter(Boolean))].sort(), [items])

  return (
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <input
        placeholder="🔍 상품명 / 편성코드 검색..."
        value={filters.search}
        onChange={e => onChange({ ...filters, search: e.target.value })}
        style={{
          width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
          color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={filters.team}
          onChange={e => onChange({ ...filters, team: e.target.value })}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10 }}
        >
          <option value="">전체 팀</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filters.dealType}
          onChange={e => onChange({ ...filters, dealType: e.target.value })}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10 }}
        >
          <option value="">거래형태</option>
          {dealTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <select
          value={filters.newType}
          onChange={e => onChange({ ...filters, newType: e.target.value })}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10 }}
        >
          <option value="">신상품구분</option>
          {newTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filters.sort}
          onChange={e => onChange({ ...filters, sort: e.target.value })}
          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 5px', borderRadius: 4, fontSize: 10 }}
        >
          <option value="">정렬</option>
          <option value="perf_desc">실적 높은순</option>
          <option value="perf_asc">실적 낮은순</option>
          <option value="new_first">신상품 우선</option>
          <option value="name_asc">편성코드명 순</option>
        </select>
      </div>
    </div>
  )
}