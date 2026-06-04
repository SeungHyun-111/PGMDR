import { useState, useMemo, useRef, useEffect } from 'react'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import ProductCard from './ProductCard'
import ProductFilters from './ProductFilters'
import SidebarExpanded from './SidebarExpanded'
import ConfirmActionModal from '../common/ConfirmActionModal'
import { DEAL_TYPES } from '../../constants/dealTypes'
import { CATEGORIES } from '../../constants/categories'
import { genKey } from '../../utils/uniqueKey'

const NEW_PRODUCT_TYPES = ['기존', '신상품', '재녹화', '재편집']
const inp = { background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11, width: '100%', boxSizing: 'border-box' }
const ADD_FIELDS = [
  { key: 'pgmCodeName',           label: '편성코드명',   required: true },
  { key: 'mdTeam',                label: '팀명',         select: 'teams' },
  { key: 'mdCategory',            label: '분류',         options: CATEGORIES },
  { key: 'dealTypeConverted',     label: '거래형태',     options: DEAL_TYPES },
  { key: 'newProductType',        label: '신상품구분',   options: NEW_PRODUCT_TYPES },
  { key: 'mainPrice',             label: '메인가' },
  { key: 'fixedFee',              label: '정액비' },
  { key: 'preferredTime',         label: '희망시간' },
  { key: 'availableWeightedMin1', label: '가용가중분' },
  { key: 'remainingSchedule',     label: '잔여편성' },
  { key: 'memoCode',              label: '메모코드' },
  { key: 'scheduleComment',       label: '편성C' },
  { key: 'requestNote',           label: '기타요청' },
]

const PAGE_SIZE = 50

export default function Sidebar({ isOpen, onToggle }) {
  const { proposalItems, perfMap, starred, loadProposals, proposalLoaded, returnBlockToSidebar, addProposalItem, weightedMinTargets, saveBlock, runUndoBatch } = useScheduleStore()

  const [filters, setFilters] = useState({
    keyword: '',
    category: '전체',
    team: '전체',
    dealType: '전체',
    newProductType: '전체',
    videoStatus: '전체',
    sort: 'none',
    starOnly: false,
  })

  const teamOptions = useMemo(
    () => weightedMinTargets.map(t => t.teamName).filter(Boolean),
    [weightedMinTargets]
  )

  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm]   = useState({})
  const [adding, setAdding]     = useState(false)

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [bottomOpen, setBottomOpen] = useState(false)
  const scrollRef = useRef(null)

  // 블록 → 사이드바 드롭 상태
  const [blockDragOver, setBlockDragOver] = useState(null) // { insertBeforeId: string|null }
  const [pinnedReturn, setPinnedReturn]   = useState(null) // { itemId, insertBeforeId }
  const [highlightId, setHighlightId]     = useState(null)
  const [returnConfirm, setReturnConfirm] = useState(null) // { block, insertBeforeId }
  const [fillReturnSlot, setFillReturnSlot] = useState(false)

  useEffect(() => {
    if ((isOpen || bottomOpen) && !proposalLoaded) loadProposals()
  }, [isOpen, bottomOpen])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [filters])

  const filteredItems = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    const base = proposalItems.filter(item => {
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
      if (filters.videoStatus !== '전체' && (item.videoStatus || '') !== filters.videoStatus) return false
      if (filters.starOnly && !starred[item.itemId]) return false
      return true
    })

    if (filters.sort === 'asc') {
      return [...base].sort((a, b) => (a.pgmCodeName || '').localeCompare(b.pgmCodeName || '', 'ko'))
    }
    if (filters.sort === 'desc') {
      return [...base].sort((a, b) => (b.pgmCodeName || '').localeCompare(a.pgmCodeName || '', 'ko'))
    }
    return [...base].sort((a, b) => (starred[b.itemId] ? 1 : 0) - (starred[a.itemId] ? 1 : 0))
  }, [proposalItems, filters, starred])

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

  const completeReturnBlock = async ({ block, insertBeforeId }) => {
    await runUndoBatch(`사이드바 반환 되돌리기: ${block.pgmCodeName || block.blockKey || block.slotId}`, async () => {
    const effectiveItemId = await returnBlockToSidebar(block)
    if (fillReturnSlot) {
      const blockKey = block.blockKey || block.slotId
      const sourceChannel = blockKey.endsWith('_CA') ? 'CA' : blockKey.endsWith('_IP') ? 'IP' : 'ALL'
      await saveBlock(blockKey, {
        ...makeDefaultBlock(block, sourceChannel),
        uniqueKey: genKey('0'),
      })
    }
    setFillReturnSlot(false)
    if (effectiveItemId) {
      setPinnedReturn({ itemId: effectiveItemId, insertBeforeId })
      setHighlightId(effectiveItemId)
      setTimeout(() => setHighlightId(null), 1800)
    }
    })
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
    setReturnConfirm({ block, insertBeforeId })
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
    <SidebarExpanded items={proposalItems} onClose={() => setBottomOpen(false)} />
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
            <button onClick={() => { setAddForm({}); setAddModal(true) }}
              style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
              + 추가
            </button>
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
                <div key={item.uniqueKey || item.itemId} style={highlightId === item.itemId ? { animation: 'cardPop .9s ease-out', borderRadius: 6 } : undefined}>
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

      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '22px 26px', width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>제안상품 추가</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>GAS 새로고침 시 원본으로 초기화됩니다.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ADD_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: ['requestNote', 'scheduleComment'].includes(f.key) ? '1 / -1' : undefined }}>
                  <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>
                    {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </label>
                  {['requestNote', 'scheduleComment'].includes(f.key) ? (
                    <textarea value={addForm[f.key] || ''} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                      rows={2} style={{ ...inp, resize: 'vertical' }} />
                  ) : f.options ? (
                    <select value={addForm[f.key] || ''} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp}>
                      <option value="">선택</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.select === 'teams' ? (
                    <select value={addForm[f.key] || ''} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp}>
                      <option value="">선택</option>
                      {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input value={addForm[f.key] || ''} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} style={inp} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddModal(false)}
                style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>취소</button>
              <button onClick={async () => {
                if (!addForm.pgmCodeName?.trim()) return
                setAdding(true)
                try { await addProposalItem(addForm); setAddModal(false); setAddForm({}) }
                finally { setAdding(false) }
              }} disabled={adding || !addForm.pgmCodeName?.trim()}
                style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.7 : 1 }}>
                {adding ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
      {returnConfirm && (
        <ConfirmActionModal
          title="사이드바로 반환"
          description={`[${returnConfirm.block.pgmCodeName || '-'}]을 편성표에서 빼고 사이드바로 반환할까요?`}
          confirmText="반환"
          onCancel={() => { setReturnConfirm(null); setFillReturnSlot(false) }}
          onConfirm={async () => {
            const pending = returnConfirm
            setReturnConfirm(null)
            await completeReturnBlock(pending)
          }}
        >
          <ReturnSlotChoice value={fillReturnSlot} onChange={setFillReturnSlot} />
        </ConfirmActionModal>
      )}
    </>
  )
}

function ReturnSlotChoice({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
      {[
        { value: false, label: '기존 슬롯 비우기' },
        { value: true, label: '[편성팀] [전사블록]으로 채우기' },
      ].map(option => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          style={{
            padding: '8px 10px',
            textAlign: 'left',
            background: value === option.value ? 'rgba(74,108,247,.10)' : 'var(--bg3)',
            border: `1px solid ${value === option.value ? 'var(--accent)' : 'var(--border)'}`,
            color: 'var(--text)',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
