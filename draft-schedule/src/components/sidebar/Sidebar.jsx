import { useState, useMemo } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'

export default function Sidebar({ isOpen, onToggle }) {
  const { proposalItems, performanceRows, manualInputs } = useScheduleStore()
  const [filters, setFilters] = useState({
    search: '', team: '', dealType: '', newType: '', sort: ''
  })

  const filtered = useMemo(() => {
    let items = [...proposalItems]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      items = items.filter(i =>
        (i.pgmCodeName || '').toLowerCase().includes(q) ||
        (i.programName || '').toLowerCase().includes(q) ||
        (i.pgmCode || '').toLowerCase().includes(q)
      )
    }
    if (filters.team) {
      items = items.filter(i => i.mdTeam === filters.team)
    }
    if (filters.dealType) {
      items = items.filter(i => i.dealType === filters.dealType)
    }
    if (filters.newType) {
      items = items.filter(i => i.newProductType === filters.newType)
    }

    if (filters.sort === 'perf_desc') {
      items.sort((a, b) => {
        const pa = performanceRows.filter(p => p.pgmCodeName === a.pgmCodeName)
        const pb = performanceRows.filter(p => p.pgmCodeName === b.pgmCodeName)
        const va = pa.length > 0 ? pa[pa.length - 1].salesPerWeightedMin : 0
        const vb = pb.length > 0 ? pb[pb.length - 1].salesPerWeightedMin : 0
        return vb - va
      })
    } else if (filters.sort === 'perf_asc') {
      items.sort((a, b) => {
        const pa = performanceRows.filter(p => p.pgmCodeName === a.pgmCodeName)
        const pb = performanceRows.filter(p => p.pgmCodeName === b.pgmCodeName)
        const va = pa.length > 0 ? pa[pa.length - 1].salesPerWeightedMin : 0
        const vb = pb.length > 0 ? pb[pb.length - 1].salesPerWeightedMin : 0
        return va - vb
      })
    } else if (filters.sort === 'new_first') {
      items.sort((a, b) => {
        const na = a.newProductType && a.newProductType !== '' ? 1 : 0
        const nb = b.newProductType && b.newProductType !== '' ? 1 : 0
        return nb - na
      })
    } else if (filters.sort === 'name_asc') {
      items.sort((a, b) => (a.pgmCodeName || '').localeCompare(b.pgmCodeName || ''))
    }

    return items
  }, [proposalItems, performanceRows, filters])

  if (!isOpen) return (
    <div
      onClick={onToggle}
      style={{
        width: 20, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--text3)', writingMode: 'vertical-rl' }}>제안상품</span>
    </div>
  )

  return (
    <div style={{
      width: 240, flexShrink: 0, background: 'var(--bg2)',
      borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column'
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: '.5px' }}>
          제안상품 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{filtered.length}건</span>
        </span>
        <button
          onClick={onToggle}
          style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}
        >✕</button>
      </div>

      {/* 필터 */}
      <ProductFilters filters={filters} onChange={setFilters} items={proposalItems} />

      {/* 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>
            검색 결과 없음
          </div>
        ) : (
          filtered.map(item => (
            <ProductCard
              key={item.itemId}
              item={item}
              performanceRows={performanceRows}
              manualInputs={manualInputs}
            />
          ))
        )}
      </div>
    </div>
  )
}