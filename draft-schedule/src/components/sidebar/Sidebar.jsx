import { useState, useMemo, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'

const PAGE_SIZE = 50

export default function Sidebar({ isOpen, onToggle }) {
  const {
    proposalItems, performanceRows, manualInputs,
    isLoadingProposals, isLoadingPerformance,
    proposalLoaded, performanceLoaded,
    loadProposals, loadPerformance
  } = useScheduleStore()

  const [filters, setFilters] = useState({
    search: '', team: '', dealType: '', newType: '', sort: ''
  })
  const [page, setPage] = useState(1)

  // 사이드바 열릴 때 지연 로드
  useEffect(() => {
    if (!isOpen) return
    loadProposals()
    loadPerformance()
  }, [isOpen])

  // performanceRows Map
  const perfMap = useMemo(() => {
    const map = {}
    performanceRows.forEach(p => {
      if (!map[p.pgmCodeName]) map[p.pgmCodeName] = []
      map[p.pgmCodeName].push(p)
    })
    return map
  }, [performanceRows])

  const filtered = useMemo(() => {
    setPage(1)
    let items = [...proposalItems]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      items = items.filter(i =>
        (i.pgmCodeName || '').toLowerCase().includes(q) ||
        (i.programName || '').toLowerCase().includes(q) ||
        (i.pgmCode || '').toLowerCase().includes(q)
      )
    }
    if (filters.team) items = items.filter(i => i.mdTeam === filters.team)
    if (filters.dealType) items = items.filter(i => i.dealType === filters.dealType)
    if (filters.newType) items = items.filter(i => i.newProductType === filters.newType)

    if (filters.sort === 'perf_desc') {
      items.sort((a, b) => {
        const va = perfMap[a.pgmCodeName]?.[perfMap[a.pgmCodeName]?.length - 1]?.salesPerWeightedMin || 0
        const vb = perfMap[b.pgmCodeName]?.[perfMap[b.pgmCodeName]?.length - 1]?.salesPerWeightedMin || 0
        return vb - va
      })
    } else if (filters.sort === 'perf_asc') {
      items.sort((a, b) => {
        const va = perfMap[a.pgmCodeName]?.[perfMap[a.pgmCodeName]?.length - 1]?.salesPerWeightedMin || 0
        const vb = perfMap[b.pgmCodeName]?.[perfMap[b.pgmCodeName]?.length - 1]?.salesPerWeightedMin || 0
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
  }, [proposalItems, perfMap, filters])

  const paged = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paged.length < filtered.length

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
      <div style={{
        padding: '8px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
          제안상품 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{filtered.length}건</span>
        </span>
        <button onClick={onToggle} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
      </div>

      <ProductFilters filters={filters} onChange={setFilters} items={proposalItems} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {(isLoadingProposals || isLoadingPerformance) ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>
            {isLoadingProposals ? '제안상품 로딩 중...' : '실적 로딩 중...'}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>
            검색 결과 없음
          </div>
        ) : (
          <>
            {paged.map(item => (
              <ProductCard
                key={item.itemId}
                item={item}
                perfList={perfMap[item.pgmCodeName] || []}
                manualInput={manualInputs[item.itemId]}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => setPage(p => p + 1)}
                style={{
                  width: '100%', padding: '8px 0', marginTop: 4,
                  background: 'var(--bg4)', border: '1px solid var(--border)',
                  color: 'var(--text2)', borderRadius: 4, fontSize: 11, cursor: 'pointer'
                }}
              >
                더 보기 ({filtered.length - paged.length}건 남음)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}