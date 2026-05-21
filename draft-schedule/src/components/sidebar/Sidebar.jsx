import { useState, useMemo, useRef, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import usePerformanceMap from '../../hooks/usePerformanceMap'
import useFilterOptions from '../../hooks/useFilterOptions'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'
import SidebarExpanded from './SidebarExpanded'

const PAGE_SIZE = 50

export default function Sidebar({ isOpen, onToggle }) {
  const { proposalItems, performanceRows, loadProposals, proposalLoaded } = useScheduleStore()
  const perfMap = usePerformanceMap(performanceRows)
  const listRef = useRef(null)
  const [filters, setFilters] = useState({ search: '', team: '', dealType: '', newType: '', sort: '' })
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (isOpen && !proposalLoaded) loadProposals()
  }, [isOpen])

  const filtered = useMemo(() => {
    let items = [...proposalItems]
    if (filters.search) {
      const q = filters.search.toLowerCase()
      items = items.filter(i => (i.pgmCodeName || '').toLowerCase().includes(q) || (i.pgmCode || '').toLowerCase().includes(q))
    }
    if (filters.team)     items = items.filter(i => i.mdTeam === filters.team)
    if (filters.dealType) items = items.filter(i => i.dealType === filters.dealType)
    if (filters.newType)  items = items.filter(i => i.newProductType === filters.newType)

    if (filters.sort === 'perf_desc') {
      items.sort((a, b) => (perfMap[b.pgmCodeName]?.[0]?.profitPerWeightedMin || 0) - (perfMap[a.pgmCodeName]?.[0]?.profitPerWeightedMin || 0))
    } else if (filters.sort === 'perf_asc') {
      items.sort((a, b) => (perfMap[a.pgmCodeName]?.[0]?.profitPerWeightedMin || 0) - (perfMap[b.pgmCodeName]?.[0]?.profitPerWeightedMin || 0))
    } else if (filters.sort === 'new_first') {
      items.sort((a, b) => (b.newProductType ? 1 : 0) - (a.newProductType ? 1 : 0))
    } else if (filters.sort === 'remain_desc') {
      items.sort((a, b) => (b.remainingSchedule || 0) - (a.remainingSchedule || 0))
    }
    return items
  }, [proposalItems, filters, perfMap])

  const paged = filtered.slice(0, page * PAGE_SIZE)

  // 편성표→사이드바 드롭 (드래그 위치에 삽입)
  const handleDropOnList = async (e) => {
    e.preventDefault()
    if (e.dataTransfer.getData('isBlock') !== 'true') return
    const blockKey = e.dataTransfer.getData('blockKey')
    if (!blockKey) return

    // 마우스 Y 위치 기준 삽입 인덱스 계산
    const cards = [...(listRef.current?.querySelectorAll('[data-card]') || [])]
    let insertIndex = proposalItems.length
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) { insertIndex = i; break }
    }

    const { scheduleBlocks, copyBlockToSidebar, removeBlock } = useScheduleStore.getState()
    const block = scheduleBlocks[blockKey]
    if (!block) return

    await copyBlockToSidebar(block)
    await removeBlock(blockKey)

    // 삽입 위치 조정
    useScheduleStore.setState(s => {
      const items = [...s.proposalItems]
      if (items.length === 0) return {}
      const added = items[items.length - 1]
      items.splice(items.length - 1, 1)
      items.splice(Math.min(insertIndex, items.length), 0, added)
      return { proposalItems: items }
    })
  }

  if (!isOpen) return (
    <div onClick={onToggle} style={{ width: 20, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--text3)', writingMode: 'vertical-rl' }}>제안상품</span>
    </div>
  )

  return (
    <>
      <div style={{ width: 260, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
            제안상품 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{filtered.length}건</span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setExpanded(v => !v)} title="하단 확장 보기"
              style={{ background: expanded ? 'var(--accent)' : 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: expanded ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>
              ⬆ 확장
            </button>
            <button onClick={onToggle} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        </div>

        {/* 필터 */}
        <ProductFilters filters={filters} onChange={f => { setFilters(f); setPage(1) }} />

        {/* 리스트 */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}
          onDragOver={e => e.preventDefault()} onDrop={handleDropOnList}>
          {!proposalLoaded ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>검색 결과 없음</div>
          ) : (
            <>
              {paged.map((item, i) => (
                <div key={item.itemId} data-card={i}>
                  <ProductCard item={item} perfMap={perfMap} index={i} />
                </div>
              ))}
              {paged.length < filtered.length && (
                <button onClick={() => setPage(p => p + 1)}
                  style={{ width: '100%', padding: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 11, cursor: 'pointer', marginTop: 4 }}>
                  더 보기 ({filtered.length - paged.length}건 남음)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 하단 확장 패널 */}
      {expanded && <SidebarExpanded items={filtered} onClose={() => setExpanded(false)} />}
    </>
  )
}