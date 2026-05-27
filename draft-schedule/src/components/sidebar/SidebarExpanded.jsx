import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { buildDragGhost } from './ProductCard'
import { getLastPerf } from '../../utils/entityKey'
import { DEAL_TYPES } from '../../constants/dealTypes'
import { CATEGORIES } from '../../constants/categories'

const NEW_PRODUCT_TYPES = ['기존', '신상품', '재녹화', '재편집']

const COLS = [
  { key: 'pgmCodeName',           label: '편성코드명',   w: 200 },
  { key: 'mdTeam',                label: '팀',           w: 68 },
  { key: 'mdCategory',            label: '분류',         w: 72 },
  { key: 'dealTypeConverted',     label: '거래형태',     w: 60 },
  { key: 'newProductType',        label: '신상품구분',   w: 58 },
  { key: 'mainPrice',             label: '메인가',       w: 76, fmt: v => v ? Number(v).toLocaleString() : '-' },
  { key: 'fixedFee',              label: '정액비',       w: 72, fmt: v => v ? Number(v).toLocaleString() : '-' },
  { key: '_sales',                label: '취급/분',      w: 76, perf: 'salesPerWeightedMin'  },
  { key: '_profit',               label: '한익/분',      w: 76, perf: 'profitPerWeightedMin' },
  { key: '_perfDate',             label: '직전방송',     w: 80, perf: 'broadcastDate'        },
  { key: 'preferredTime',         label: '희망시간',     w: 68 },
  { key: 'availableWeightedMin1', label: '가용가중분',   w: 68 },
  { key: 'remainingSchedule',     label: '잔여편성',     w: 56 },
  { key: 'requestNote',           label: '기타요청',     w: 220 },
]

const EDITABLE = new Set([
  'pgmCodeName', 'mdTeam', 'mdCategory', 'dealTypeConverted', 'newProductType',
  'mainPrice', 'fixedFee', 'preferredTime', 'availableWeightedMin1',
  'remainingSchedule', 'requestNote',
])

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
  { key: 'requestNote',           label: '기타요청' },
]

const inp = { background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11, width: '100%', boxSizing: 'border-box' }

export default function SidebarExpanded({ items, onClose }) {
  const { perfMap, starred, toggleStarred, updateProposalItem, addProposalItem, deleteProposalItem, duplicateProposalItem, returnBlockToSidebar, weightedMinTargets, entityProps } = useScheduleStore()
  const [keyword, setKeyword]       = useState('')
  const [teamFilter, setTeamFilter] = useState('전체')
  const [starOnly, setStarOnly]     = useState(false)
  const [sortKey, setSortKey]       = useState(null)
  const [sortDir, setSortDir]       = useState('asc')
  const [editing, setEditing]       = useState(null)
  const [editValue, setEditValue]   = useState('')
  const [addModal, setAddModal]     = useState(false)
  const [addForm, setAddForm]       = useState({})
  const [adding, setAdding]         = useState(false)
  const [panelHeight, setPanelHeight] = useState(272)
  const [blockDragOver, setBlockDragOver] = useState(null) // { insertBeforeId: string|null }
  const [pinnedReturn, setPinnedReturn]   = useState(null) // { itemId, insertBeforeId }
  const [highlightId, setHighlightId]     = useState(null)
  const [ctxMenu, setCtxMenu]             = useState(null) // { x, y, itemId }

  useEffect(() => {
    document.documentElement.style.setProperty('--panel-h', panelHeight + 'px')
    return () => document.documentElement.style.setProperty('--panel-h', '0px')
  }, [panelHeight])

  const startResize = useCallback(e => {
    e.preventDefault()
    const startY = e.clientY
    const startH = panelHeight
    const onMove = mv => setPanelHeight(Math.max(180, Math.min(window.innerHeight * 0.75, startH + startY - mv.clientY)))
    const onUp   = ()  => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [panelHeight])

  const teams = useMemo(() => {
    const set = new Set(items.map(i => i.mdTeam || '').filter(Boolean))
    return ['전체', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))]
  }, [items])

  const teamOptions = useMemo(
    () => weightedMinTargets.map(t => t.teamName).filter(Boolean),
    [weightedMinTargets]
  )

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const displayed = useMemo(() => {
    let list = items.filter(i => {
      if (starOnly && !starred[i.itemId]) return false
      if (keyword.trim()) {
        const t = [i.pgmCodeName, i.mdTeam, i.mdCategory].join(' ').toLowerCase()
        if (!t.includes(keyword.trim().toLowerCase())) return false
      }
      if (teamFilter !== '전체' && (i.mdTeam || '') !== teamFilter) return false
      return true
    })
    if (!sortKey) {
      return [...list].sort((a, b) => (starred[b.itemId] ? 1 : 0) - (starred[a.itemId] ? 1 : 0))
    }
    return [...list].sort((a, b) => {
      const col = COLS.find(c => c.key === sortKey)
      let va = col?.perf ? (perfMap[a.perfKey]?.[col.perf] ?? '') : (a[sortKey] ?? '')
      let vb = col?.perf ? (perfMap[b.perfKey]?.[col.perf] ?? '') : (b[sortKey] ?? '')
      const isNum = va !== '' && !isNaN(Number(va))
      const cmp = isNum
        ? Number(va || 0) - Number(vb || 0)
        : String(va).localeCompare(String(vb), 'ko')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, keyword, teamFilter, sortKey, sortDir, perfMap])

  const visibleRows = useMemo(() => {
    if (!pinnedReturn) return displayed
    const list = [...displayed]
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
  }, [displayed, pinnedReturn])

  const handleTableDragOver = (e) => {
    if (!e.dataTransfer.types.includes('blockkey')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rows = e.currentTarget.querySelectorAll('tr[data-item-id]')
    let insertBeforeId = null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeId = row.getAttribute('data-item-id')
        break
      }
    }
    setBlockDragOver({ insertBeforeId })
  }

  const handleTableDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setBlockDragOver(null)
  }

  const handleTableDrop = async (e) => {
    e.preventDefault()
    const blockKey = e.dataTransfer.getData('blockKey')
    if (!blockKey) return

    // drop 시점 clientY로 삽입 위치 재계산
    const rows = e.currentTarget.querySelectorAll('tr[data-item-id]')
    let insertBeforeId = null
    for (const row of rows) {
      const rect = row.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        insertBeforeId = row.getAttribute('data-item-id')
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

  const startEdit = (item, col) => {
    if (col.perf || !EDITABLE.has(col.key)) return
    setEditing({ itemId: item.itemId, colKey: col.key, fbIdx: item._fbIdx })
    setEditValue(String(item[col.key] ?? ''))
  }

  const commitEdit = async item => {
    if (!editing) return
    const { colKey, fbIdx } = editing
    const newVal = editValue.trim()
    const oldVal = String(item[colKey] ?? '')
    if (newVal !== oldVal) {
      await updateProposalItem(item.itemId, fbIdx, { [colKey]: newVal })
    }
    setEditing(null)
  }

  const handleAddSubmit = async () => {
    if (!addForm.pgmCodeName?.trim()) return
    setAdding(true)
    try {
      await addProposalItem(addForm)
      setAddModal(false)
      setAddForm({})
    } finally {
      setAdding(false)
    }
  }

  const th = {
    position: 'sticky', top: 0, zIndex: 1,
    background: 'var(--bg4)',
    padding: '9px 10px',
    textAlign: 'left',
    fontSize: 10, fontWeight: 700, color: 'var(--text2)',
    borderBottom: '2px solid var(--accent)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    letterSpacing: '.06em',
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: panelHeight,
      background: 'var(--bg2)',
      borderTop: '3px solid var(--accent)',
      zIndex: 200,
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 -8px 32px rgba(0,0,0,.25)',
    }}>

      {/* 리사이즈 핸들 */}
      <div onMouseDown={startResize}
        style={{ height: 6, cursor: 'ns-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', flexShrink: 0 }}>
        <div style={{ width: 36, height: 3, borderRadius: 2, background: 'var(--border2)' }} />
      </div>

      {/* 헤더 */}
      <div style={{ padding: '5px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--bg3)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0, letterSpacing: '-.01em' }}>
          제안상품
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginLeft: 5 }}>{displayed.length}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 2 }}>건</span>
        </span>

        <button onClick={() => setStarOnly(v => !v)}
          style={{ background: starOnly ? 'var(--yellow)' : 'var(--bg4)', border: '1px solid var(--border2)', color: starOnly ? '#fff' : 'var(--text3)', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
          ★
        </button>

        <div style={{ width: 1, height: 14, background: 'var(--border2)', flexShrink: 0 }} />

        {/* 팀 필터 */}
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text2)', padding: '3px 6px', borderRadius: 5, fontSize: 11, maxWidth: 110, outline: 'none' }}>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder="검색..."
          style={{ width: 160, background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '3px 9px', borderRadius: 5, fontSize: 11, outline: 'none' }}
        />

        <span style={{ fontSize: 10, color: 'var(--text3)', paddingLeft: 4, borderLeft: '1px solid var(--border)' }}>
          드래그 → 배치 &nbsp;·&nbsp; 셀 클릭 → 편집
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => { setAddForm({}); setAddModal(true) }}
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: '4px 12px', borderRadius: 5, fontWeight: 700, letterSpacing: '-.01em' }}>
            + 추가
          </button>
          <button onClick={onClose}
            style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: '4px 10px', borderRadius: 5 }}>
            접기 ▼
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div
        style={{ flex: 1, overflow: 'auto', background: blockDragOver ? 'rgba(74,108,247,.04)' : 'var(--bg)', transition: 'background .1s' }}
        onDragOver={handleTableDragOver}
        onDragLeave={handleTableDragLeave}
        onDrop={handleTableDrop}
      >
        <style>{`@keyframes rowPop{0%{outline:2px solid var(--accent)}100%{outline:0}}`}</style>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 26, textAlign: 'center', fontSize: 12, color: 'var(--yellow)', cursor: 'default' }}>★</th>
              {COLS.map(col => {
                const active = sortKey === col.key
                return (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ ...th, width: col.w, cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text2)' }}>
                    {col.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((item, rowIdx) => {
              const lastPerf  = getLastPerf(item, entityProps, perfMap)
              const isStarred = !!starred[item.itemId]
              const isNew     = !!item.newProductType
              const stripeBg  = rowIdx % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'
              const baseBg    = isStarred ? 'rgba(217,119,6,.10)' : stripeBg
              const isHighlighted = highlightId === item.itemId

              return (
                <React.Fragment key={item.itemId}>
                  {blockDragOver?.insertBeforeId === item.itemId && (
                    <tr style={{ pointerEvents: 'none' }}>
                      <td colSpan={COLS.length + 1} style={{ padding: 0, height: 2, background: 'var(--accent)' }} />
                    </tr>
                  )}
                <tr
                  data-item-id={item.itemId}
                  draggable
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, itemId: item.itemId }) }}
                  onDragStart={e => {
                    e.dataTransfer.setData('itemId', item.itemId)
                    e.dataTransfer.effectAllowed = 'move'
                    const ghost = buildDragGhost(item)
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 105, 28)
                    requestAnimationFrame(() => document.body.removeChild(ghost))
                  }}
                  style={{
                    background: baseBg,
                    borderBottom: '1px solid var(--border)',
                    userSelect: 'none',
                    transition: 'background .1s ease',
                    cursor: 'grab',
                    outline: isHighlighted ? '2px solid var(--accent)' : undefined,
                    animation: isHighlighted ? 'rowPop 1.8s ease-out forwards' : undefined,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,108,247,.14)'}
                  onMouseLeave={e => e.currentTarget.style.background = baseBg}
                >
                  <td style={{ padding: '3px 6px', textAlign: 'center', cursor: 'default', borderRight: '1px solid var(--border)' }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleStarred(item.itemId) }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: isStarred ? 'var(--yellow)' : 'var(--border2)', transition: 'color .15s' }}
                    >{isStarred ? '★' : '☆'}</button>
                  </td>

                  {COLS.map(col => {
                    const isEditing = editing?.itemId === item.itemId && editing?.colKey === col.key
                    const editable  = !col.perf && EDITABLE.has(col.key)

                    let val = '-'
                    let color = 'var(--text)'
                    let fontWeight = 400

                    if (col.perf) {
                      const v = lastPerf?.[col.perf]
                      if (v != null) {
                        val = col.perf === 'broadcastDate' ? String(v) : Number(v).toLocaleString()
                      }
                      if (col.perf === 'salesPerWeightedMin')  { color = 'var(--accent)'; fontWeight = val !== '-' ? 600 : 400 }
                      if (col.perf === 'profitPerWeightedMin') { color = 'var(--green)';  fontWeight = val !== '-' ? 600 : 400 }
                      if (col.perf === 'broadcastDate') color = 'var(--text3)'
                    } else if (col.fmt) {
                      val = col.fmt(item[col.key])
                    } else {
                      val = item[col.key] || '-'
                    }

                    if (col.key === 'newProductType' && val !== '-') color = 'var(--yellow)'
                    if (col.key === 'pgmCodeName') fontWeight = 600

                    return (
                      <td key={col.key}
                        onClick={() => !isEditing && startEdit(item, col)}
                        style={{
                          padding: isEditing ? '2px 5px' : '5px 10px',
                          color,
                          fontWeight,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: isEditing ? 'unset' : 'ellipsis',
                          maxWidth: col.w,
                          lineHeight: 1.4,
                          verticalAlign: 'middle',
                          cursor: editable ? 'text' : 'default',
                          background: isEditing ? 'var(--bg4)' : undefined,
                        }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(item)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitEdit(item) }
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', padding: 0 }}
                          />
                        ) : val}
                      </td>
                    )
                  })}
                </tr>
                </React.Fragment>
              )
            })}
            {blockDragOver?.insertBeforeId === null && (
              <tr style={{ pointerEvents: 'none' }}>
                <td colSpan={COLS.length + 1} style={{ padding: 0, height: 2, background: 'var(--accent)' }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {ctxMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setCtxMenu(null)} onContextMenu={e => e.preventDefault()}>
          <div style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.35)', zIndex: 9999, overflow: 'hidden', minWidth: 120 }}>
            <button onClick={() => { duplicateProposalItem(ctxMenu.itemId); setCtxMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              복사
            </button>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <button onClick={() => { deleteProposalItem(ctxMenu.itemId); setCtxMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 아이템 추가 모달 */}
      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '22px 26px', width: 480, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>제안상품 추가</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>GAS 새로고침 시 원본으로 초기화됩니다.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ADD_FIELDS.map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: f.key === 'requestNote' ? '1 / -1' : undefined }}>
                  <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>
                    {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </label>
                  {f.key === 'requestNote' ? (
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
              <button onClick={handleAddSubmit} disabled={adding || !addForm.pgmCodeName?.trim()}
                style={{ flex: 2, padding: '8px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.7 : 1 }}>
                {adding ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
