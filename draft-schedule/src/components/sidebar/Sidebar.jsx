import { useState, useMemo, useRef, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'
import SidebarExpanded from './SidebarExpanded'

const PAGE_SIZE = 50

export default function Sidebar({ isOpen, onToggle }) {
  const { proposalItems, perfMap, loadProposals, proposalLoaded } = useScheduleStore()

  const [filters, setFilters] = useState({
    keyword: '',
    category: '전체',
    team: '전체',
    dealType: '전체',
    newProductType: '전체',
    hasPerf: '전체',
  })

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (isOpen && !proposalLoaded) loadProposals()
  }, [isOpen])

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
      return true
    })
  }, [proposalItems, filters, perfMap])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredItems.length))
    }
  }

  if (!isOpen) return (
    <div onClick={onToggle}
      style={{ width: 20, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--text3)', writingMode: 'vertical-rl' }}>제안상품</span>
    </div>
  )

  return (
    <>
      <div style={{ width: 260, flexShrink: 0, background: 'var(--bg2)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
            상품 풀 <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{filteredItems.length}건</span>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setExpanded(v => !v)}
              style={{ background: expanded ? 'var(--accent)' : 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: expanded ? '#fff' : 'var(--text3)', cursor: 'pointer' }}>
              ⬆ 확장
            </button>
            <button onClick={onToggle}
              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>✕</button>
          </div>
        </div>

        <ProductFilters filters={filters} setFilters={setFilters} />

        <div ref={scrollRef} onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {!proposalLoaded ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>로딩 중...</div>
          ) : filteredItems.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>검색 결과 없음</div>
          ) : (
            <>
              {filteredItems.slice(0, visibleCount).map((item, i) => (
                <ProductCard key={item.itemId} item={item} perfMap={perfMap} index={i} />
              ))}
              {visibleCount < filteredItems.length && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                  스크롤하면 더 불러옵니다
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && <SidebarExpanded items={filteredItems} onClose={() => setExpanded(false)} />}
    </>
  )
}