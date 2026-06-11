import React, { useState, useMemo, useCallback, useEffect } from 'react'
import useScheduleStore, { makeDefaultBlock } from '../../store/useScheduleStore'
import { buildDragGhost } from './ProductCard'
import ConfirmActionModal from '../common/ConfirmActionModal'
import MemoCodeSelect from '../common/MemoCodeSelect'
import { getLastPerf } from '../../utils/entityKey'
import { DEAL_TYPES } from '../../constants/dealTypes'
import { CATEGORIES } from '../../constants/categories'
import { genKey } from '../../utils/uniqueKey'
import { makePerfKey, normalizeDealType } from '../../hooks/usePerformanceMap'

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
  { key: 'memoCode',              label: '메모코드',     w: 90 },
  { key: 'memoCode2',             label: '메모코드2',    w: 90 },
  { key: 'scheduleComment',       label: '편성C',        w: 120 },
  { key: 'requestNote',           label: '기타요청',     w: 220 },
]

const EDITABLE = new Set([
  'pgmCodeName', 'mdTeam', 'mdCategory', 'dealTypeConverted', 'newProductType',
  'mainPrice', 'fixedFee', 'preferredTime', 'availableWeightedMin1',
  'remainingSchedule', 'memoCode', 'memoCode2', 'scheduleComment', 'requestNote',
])

const ENTITY_EDIT_FIELDS = new Set([
  'pgmCodeName', 'mdTeam', 'mdCategory', 'dealTypeConverted', 'newProductType',
  'memoCode', 'memoCode2', 'scheduleComment', 'requestNote',
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
  { key: 'memoCode',              label: '메모코드' },
  { key: 'memoCode2',             label: '메모코드2' },
  { key: 'scheduleComment',       label: '편성C' },
  { key: 'requestNote',           label: '기타요청' },
]

const inp = { background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 4, fontSize: 11, width: '100%', boxSizing: 'border-box' }
const MIN_COL_WIDTH = 44
const memoCodePatch = (key, value, meta) => ({
  [key]: value,
  [`${key}Code`]: meta?.code || '',
})

export default function SidebarExpanded({ items, onClose }) {
  const { perfMap, latestPerfByKey, starred, toggleStarred, updateProposalItem, addProposalItem, deleteProposalItem, duplicateProposalItem, returnBlockToSidebar, weightedMinTargets, entityProps, saveBlock, saveEntityProps, runUndoBatch } = useScheduleStore()
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
  const [returnConfirm, setReturnConfirm] = useState(null) // { block, insertBeforeId }
  const [fillReturnSlot, setFillReturnSlot] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { itemId, name }
  const [ctxMenu, setCtxMenu]             = useState(null) // { x, y, itemId }
  const [colWidths, setColWidths] = useState(() =>
    Object.fromEntries(COLS.map(col => [col.key, col.w]))
  )

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

  const startColumnResize = useCallback((e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = colWidths[key] || COLS.find(col => col.key === key)?.w || MIN_COL_WIDTH
    const onMove = mv => {
      const nextW = Math.max(MIN_COL_WIDTH, startW + mv.clientX - startX)
      setColWidths(prev => ({ ...prev, [key]: nextW }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths])

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
      let va = col?.perf ? (getLastPerf(a, entityProps, perfMap, latestPerfByKey)?.[col.perf] ?? '') : (a[sortKey] ?? '')
      let vb = col?.perf ? (getLastPerf(b, entityProps, perfMap, latestPerfByKey)?.[col.perf] ?? '') : (b[sortKey] ?? '')
      const isNum = va !== '' && !isNaN(Number(va))
      const cmp = isNum
        ? Number(va || 0) - Number(vb || 0)
        : String(va).localeCompare(String(vb), 'ko')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [items, keyword, teamFilter, starOnly, starred, sortKey, sortDir, perfMap, latestPerfByKey, entityProps])

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

  const tableWidth = useMemo(
    () => 26 + COLS.reduce((sum, col) => sum + (colWidths[col.key] || col.w), 0),
    [colWidths]
  )

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
    setReturnConfirm({ block, insertBeforeId })
  }

  const startEdit = (item, col) => {
    if (col.perf || !EDITABLE.has(col.key)) return
    setEditing({ itemId: item.itemId, uniqueKey: item.uniqueKey, colKey: col.key, fbIdx: item._fbIdx })
    setEditValue(String(item[col.key] ?? ''))
  }

  const commitEdit = async (item, overrideValue, memoMeta = null) => {
    if (!editing) return
    const { colKey, fbIdx, uniqueKey } = editing
    const newVal = String(overrideValue ?? editValue).trim()
    const oldVal = String(item[colKey] ?? '')
    if (newVal !== oldVal) {
      await runUndoBatch(`사이드바 상품 수정 되돌리기: ${item.pgmCodeName || item.itemId}`, async () => {
      if (item.uniqueKey && ENTITY_EDIT_FIELDS.has(colKey)) {
        const patch = ['memoCode', 'memoCode2'].includes(colKey)
          ? memoCodePatch(colKey, newVal, memoMeta)
          : { [colKey]: newVal }
        const nextName = colKey === 'pgmCodeName' ? newVal : item.pgmCodeName
        const nextDeal = colKey === 'dealTypeConverted' ? newVal : (item.dealTypeConverted || item.dealType || '')
        const nextConverted = normalizeDealType(nextDeal)
        if (colKey === 'pgmCodeName' || colKey === 'dealTypeConverted') {
          patch.dealTypeConverted = nextConverted
          patch.perfKey = nextName ? makePerfKey(nextConverted, nextName) : null
        }
        if (colKey === 'dealTypeConverted') patch.dealType = nextConverted
        if (colKey === 'mdTeam') patch.orgName = newVal
        await saveEntityProps(item.uniqueKey, patch)
      } else {
        const patch = ['memoCode', 'memoCode2'].includes(colKey)
          ? memoCodePatch(colKey, newVal, memoMeta)
          : { [colKey]: newVal }
        await updateProposalItem(item.itemId, fbIdx, patch, uniqueKey)
      }
      })
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
    boxSizing: 'border-box',
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
        className="sidebar-expanded-table-scroll"
        style={{ flex: 1, overflow: 'auto', overflowX: 'auto', background: blockDragOver ? 'rgba(74,108,247,.04)' : 'var(--bg)', transition: 'background .1s' }}
        onDragOver={handleTableDragOver}
        onDragLeave={handleTableDragLeave}
        onDrop={handleTableDrop}
      >
        <style>{`
          @keyframes rowPop{0%{outline:2px solid var(--accent)}100%{outline:0}}
          .sidebar-expanded-table-scroll {
            scrollbar-width: auto;
            scrollbar-color: var(--border2) var(--bg3);
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar {
            width: 16px;
            height: 18px;
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-track {
            background: var(--bg3);
            border-top: 1px solid var(--border);
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-thumb {
            background: var(--border2);
            border: 4px solid var(--bg3);
            border-radius: 999px;
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-thumb:hover {
            background: var(--text3);
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-button:horizontal {
            width: 22px;
            background-color: var(--bg4);
            border-top: 1px solid var(--border);
            background-repeat: no-repeat;
            background-position: center;
            background-size: 10px 10px;
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-button:horizontal:decrement {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M6.8 1.5 3.2 5l3.6 3.5' fill='none' stroke='%238b90ab' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-button:horizontal:increment {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M3.2 1.5 6.8 5 3.2 8.5' fill='none' stroke='%238b90ab' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          }
          .sidebar-expanded-table-scroll::-webkit-scrollbar-button:vertical {
            height: 18px;
            background: var(--bg4);
          }
        `}</style>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 26, textAlign: 'center', fontSize: 12, color: 'var(--yellow)', cursor: 'default' }}>★</th>
              {COLS.map(col => {
                const active = sortKey === col.key
                const width = colWidths[col.key] || col.w
                return (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{ ...th, width, minWidth: width, cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text2)' }}>
                    <span
                      onMouseDown={e => startColumnResize(e, col.key)}
                      onClick={e => e.stopPropagation()}
                      title="열 너비 조정"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -7,
                        width: 14,
                        height: '100%',
                        cursor: 'col-resize',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: 1,
                          height: '100%',
                          background: active ? 'var(--accent)' : 'var(--border2)',
                          opacity: 0.95,
                          pointerEvents: 'none',
                        }}
                      />
                    </span>
                    {col.label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((item, rowIdx) => {
              const lastPerf  = getLastPerf(item, entityProps, perfMap, latestPerfByKey)
              const isStarred = !!starred[item.itemId]
              const stripeBg  = rowIdx % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'
              const baseBg    = isStarred ? 'rgba(217,119,6,.10)' : stripeBg
              const isHighlighted = highlightId === item.itemId

              return (
                <React.Fragment key={item.uniqueKey || item.itemId}>
                  {blockDragOver?.insertBeforeId === item.itemId && (
                    <tr style={{ pointerEvents: 'none' }}>
                      <td colSpan={COLS.length + 1} style={{ padding: 0, height: 2, background: 'var(--accent)' }} />
                    </tr>
                  )}
                <tr
                  data-item-id={item.itemId}
                  draggable
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, itemId: item.itemId, uniqueKey: item.uniqueKey }) }}
                  onDragStart={e => {
                    if (e.target.closest('input,textarea,select')) {
                      e.preventDefault()
                      return
                    }
                    e.dataTransfer.setData('itemId', item.itemId)
                    if (item.uniqueKey) e.dataTransfer.setData('uniqueKey', item.uniqueKey)
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
                    const isEditing = (editing?.uniqueKey ? editing.uniqueKey === item.uniqueKey : editing?.itemId === item.itemId) && editing?.colKey === col.key
                    const editable  = !col.perf && EDITABLE.has(col.key)
                    const width = colWidths[col.key] || col.w

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
                          overflow: isEditing && ['memoCode', 'memoCode2'].includes(col.key) ? 'visible' : 'hidden',
                          textOverflow: isEditing ? 'unset' : 'ellipsis',
                          position: isEditing && ['memoCode', 'memoCode2'].includes(col.key) ? 'relative' : undefined,
                          width,
                          minWidth: width,
                          maxWidth: width,
                          lineHeight: 1.4,
                          verticalAlign: 'middle',
                          cursor: editable ? 'text' : 'default',
                          background: isEditing ? 'var(--bg4)' : undefined,
                        }}>
                        {isEditing ? (
                          ['requestNote', 'scheduleComment'].includes(col.key) ? (
                            <textarea
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => commitEdit(item)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(item) }
                                if (e.key === 'Escape') setEditing(null)
                              }}
                              onClick={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                              onDragStart={e => e.stopPropagation()}
                              rows={2}
                              style={{ width: '100%', minWidth: 150, background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', padding: 0, resize: 'vertical' }}
                            />
                          ) : ['memoCode', 'memoCode2'].includes(col.key) ? (
                            <MemoCodeSelect
                              autoFocus
                              value={editValue}
                              onChange={setEditValue}
                              onCommit={(value, meta) => commitEdit(item, value, meta)}
                              inputStyle={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', padding: 0 }}
                            />
                          ) : (
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
                              onMouseDown={e => e.stopPropagation()}
                              onDragStart={e => e.stopPropagation()}
                              style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 11, outline: 'none', padding: 0 }}
                            />
                          )
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
            <button onClick={() => { duplicateProposalItem(ctxMenu.itemId, ctxMenu.uniqueKey); setCtxMenu(null) }}
              style={{ display: 'block', width: '100%', padding: '9px 14px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              복사
            </button>
            <div style={{ height: 1, background: 'var(--border)' }} />
            <button onClick={() => {
              const item = visibleRows.find(row => ctxMenu.uniqueKey ? row.uniqueKey === ctxMenu.uniqueKey : row.itemId === ctxMenu.itemId)
              setDeleteConfirm({ itemId: ctxMenu.itemId, uniqueKey: ctxMenu.uniqueKey, name: item?.pgmCodeName || '-' })
              setCtxMenu(null)
            }}
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
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: ['requestNote', 'scheduleComment'].includes(f.key) ? '1 / -1' : undefined }}>
                  <label style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>
                    {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
                  </label>
                  {['memoCode', 'memoCode2'].includes(f.key) ? (
                    <MemoCodeSelect
                      value={addForm[f.key] || ''}
                      onChange={(value, meta) => setAddForm(p => ({ ...p, ...memoCodePatch(f.key, value, meta) }))}
                      inputStyle={inp}
                    />
                  ) : ['requestNote', 'scheduleComment'].includes(f.key) ? (
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
      {deleteConfirm && (
        <ConfirmActionModal
          title="제안상품 삭제"
          description={`[${deleteConfirm.name}]을 제안상품 목록에서 삭제할까요?`}
          confirmText="삭제"
          danger
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            const pending = deleteConfirm
            setDeleteConfirm(null)
            deleteProposalItem(pending.itemId, pending.uniqueKey)
          }}
        />
      )}
    </div>
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
