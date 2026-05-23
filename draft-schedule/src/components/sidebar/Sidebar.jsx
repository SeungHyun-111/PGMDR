import { useState, useMemo, useRef, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'
import SidebarExpanded from './SidebarExpanded'

const PAGE_SIZE = 50

export default function Sidebar({ isOpen, onToggle }) {
  const { proposalItems, perfMap, starred, loadProposals, proposalLoaded, returnBlockToSidebar } = useScheduleStore()

  const [filters, setFilters] = useState({
    keyword: '',
    category: '전체',
    team: '전체',
    dealType: '전체',
    newProductType: '전체',
    hasPerf: '전체',
    starOnly: false,
  })

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [bottomOpen, setBottomOpen] = useState(false)
  const scrollRef = useRef(null)

  // 블록 → 사이드바 드롭 상태
  const [blockDragOver, setBlockDragOver] = useState(null) // { insertBeforeId: string|null }
  const [pinnedReturn, setPinnedReturn]   = useState(null) // { itemId, insertBeforeId }
  const [highlightId, setHighlightId]     = useState(null)

  useEffect(() => {
    if ((isOpen || bottomOpen) && !proposalLoaded) loadProposals()
  }, [isOpen, bottomOpen])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [filters])

  const filteredItems = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return proposalItems.filter(item => {
      if (keyword) {
        const target = [item.pgmCodeName, item.mdTeam, item.mdCategory].join(' ').toLowerCase()
        if (!target.includes(keyword)) return false
      }
      if (filters.team !== '전체' && (item.mdTeam || item.team) !== filters.team) return false
      if (filters.dealType !== '전체') {
        const t = item.dealTypeConverted || item.dealType || ''
        if (t !== filters.dealType) return false
      }
      if (filters.newProductType !== '전체' && item.newProductType !== filters.newProductType) return false
      if (filters.hasPerf !== '전체') {
        const has = !!perfMap[item.perfKey]
        if (filters.hasPerf === '있음' && !has) return false
        if (filters.hasPerf === '없음' && has) return false
      }
      if (filters.starOnly && !starred[item.itemId]) return false
      return true
    }).sort((a, b) => {
      const as = starred[a.itemId] ? 1 : 0
      const bs = starred[b.itemId] ? 1 : 0
      return bs - as
    })
  }, [proposalItems, filters, perfMap])

  // pinnedReturn 적용: 반환된 아이템을 드롭 위치에 삽입
  const visibleItems = useMemo(() => {
    if (!pinnedReturn) return filteredItems
    const list = [...filteredItems]
    const { itemId, insertBeforeId } = pinnedReturn
    const idx = list.findIndex(i => i.itemId === itemId)
    if (idx < 0) return list
    const [item] = list.splice(idx, 1)
    if (insertBeforeId) {
      const target = list.findIndex(i => i.itemId === insertBeforeId)
      list.splice(target >= 0 ? target : list.length, 0, item)
    } else {
      list.push(item)
    }
    return list
  }, [filteredItems, pinnedReturn])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, visibleItems.length))
    }
  }

  // 블록 드래그 → 사이드바 드롭 핸들러
  const handleScrollDragOver = (e) => {
    if (!e.dataTransfer.types.includes('blockkey')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const cards = scrollRef.current?.querySelectorAll('[data-item-id]')
    if (!cards) return
    let insertBeforeId = null
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeId = card.getAttribute('data-item-id')
        break
      }
    }
    setBlockDragOver({ insertBeforeId })
  }

  const handleScrollDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setBlockDragOver(null)
  }

  const handleScrollDrop = async (e) => {
    e.preventDefault()
    const blockKey = e.dataTransfer.getData('blockKey')
    if (!blockKey) return

    // drop 시점의 clientY로 삽입 위치 재계산 (dragOver 상태보다 정확)
    const cards = e.currentTarget.querySelectorAll('[data-item-id]')
    let insertBeforeId = null
    for (const card of cards) {
      const rect = card.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeId = card.getAttribute('data-item-id')
        break
      }
    }

    setBlockDragOver(null)
    const { scheduleBlocks } = useScheduleStore.getState()
    const block = scheduleBlocks[blockKey]
    if (!block || block.isCompeting) return
    const effectiveItemId = await returnBlockToSidebar(block)
    if (effectiveItemId) {
      setPinnedReturn({ itemId: effectiveItemId, insertBeforeId })
      setHighlightId(effectiveItemId)
      setTimeout(() => setHighlightId(null), 1800)
    }
  }

  const handleExpand = () => {
    if (!bottomOpen) {
      setBottomOpen(true)
      if (isOpen) onToggle()
    } else {
      setBottomOpen(false)
    }
  }

  const bottomPanel = bottomOpen && (
    <SidebarExpanded items={filteredItems} onClose={() => setBottomOpen(false)} />
  )

  if (!isOpen) return (
    <>
      <div onClick={onToggle}
        style={{ width: 20, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', writingMode: 'vertical-rl' }}>제안상품</span>
      </div>
      {bottomPanel}
    </>
  )

  return (
    <>
      <div style={{ width: 260, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
            상품 풀 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{filteredItems.length}건</span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleExpand}
              style={{ background: bottomOpen ? 'var(--accent)' : 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: bottomOpen ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>
              ⬆ 확장
            </button>
            <button onClick={onToggle}
              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        </div>

        <ProductFilters filters={filters} setFilters={setFilters} />

        <style>{`
          @keyframes cardPop { 0%{box-shadow:0 0 0 3px var(--accent)} 100%{box-shadow:0 0 0 0 transparent} }
        `}</style>
        <div ref={scrollRef} onScroll={handleScroll}
          onDragOver={handleScrollDragOver}
          onDragLeave={handleScrollDragLeave}
          onDrop={handleScrollDrop}
          style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', background: blockDragOver ? 'rgba(74,108,247,.04)' : undefined, transition: 'background .1s' }}>
          {!proposalLoaded ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>로딩 중...</div>
          ) : visibleItems.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>검색 결과 없음</div>
          ) : (
            <>
              {visibleItems.slice(0, visibleCount).map((item) => (
                <div key={item.itemId} style={highlightId === item.itemId ? { animation: 'cardPop .9s ease-out', borderRadius: 6 } : undefined}>
                  {blockDragOver?.insertBeforeId === item.itemId && (
                    <div style={{ height: 2, borderRadius: 1, background: 'var(--accent)', margin: '1px 0 3px' }} />
                  )}
                  <ProductCard item={item} perfMap={perfMap} />
                </div>
              ))}
              {blockDragOver?.insertBeforeId === null && (
                <div style={{ height: 2, borderRadius: 1, background: 'var(--accent)', margin: '3px 0 1px' }} />
              )}
              {visibleCount < visibleItems.length && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                  스크롤하면 더 불러옵니다
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {bottomPanel}
    </>
  )
}