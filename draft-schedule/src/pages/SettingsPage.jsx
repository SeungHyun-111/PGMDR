import { useMemo, useState } from 'react'
import useMemoCodes from '../hooks/useMemoCodes'

const DEFAULT_WIDTHS = { no: 54, code: 92, name: 280, use: 74, owner: 120, actions: 118 }
const COLUMNS = [
  { key: 'no', label: 'No' },
  { key: 'code', label: '메모코드' },
  { key: 'name', label: '메모코드명' },
  { key: 'use', label: '사용' },
  { key: 'owner', label: '등록자명' },
]

const emptyForm = { code: '', name: '', use: 'Y', owner: '' }

export default function SettingsPage() {
  const { memoCodes: rows, loading, error, saveMemoCodes } = useMemoCodes()
  const [keyword, setKeyword] = useState('')
  const [useFilter, setUseFilter] = useState('전체')
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' })
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingCode, setEditingCode] = useState(null)
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    const list = rows.filter(row => {
      if (useFilter !== '전체' && row.use !== useFilter) return false
      if (!q) return true
      return [row.code, row.name, row.owner, row.use].join(' ').toLowerCase().includes(q)
    })
    return [...list].sort((a, b) => {
      const av = sort.key === 'no' ? Number(a.no || 0) : String(a[sort.key] || '')
      const bv = sort.key === 'no' ? Number(b.no || 0) : String(b[sort.key] || '')
      const cmp = typeof av === 'number'
        ? av - bv
        : av.localeCompare(bv, 'ko', { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, keyword, useFilter, sort])

  const activeCount = rows.filter(row => row.use === 'Y').length

  const handleSort = key => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }

  const startResize = (e, key) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = widths[key] || DEFAULT_WIDTHS[key] || 80
    const onMove = ev => {
      const next = Math.max(44, startW + ev.clientX - startX)
      setWidths(prev => ({ ...prev, [key]: next }))
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
  }

  const normalizeForm = data => {
    const rawCode = String(data.code || '').trim()
    return {
      code: rawCode ? rawCode.padStart(3, '0').slice(-3) : '',
      name: String(data.name || '').trim(),
      use: data.use === 'N' ? 'N' : 'Y',
      owner: String(data.owner || '').trim(),
    }
  }

  const handleAdd = async () => {
    const next = normalizeForm(form)
    if (!next.code || !next.name) return
    if (rows.some(row => row.code === next.code)) {
      alert('이미 등록된 메모코드입니다.')
      return
    }
    const maxNo = Math.max(0, ...rows.map(row => Number(row.no || 0)))
    await saveMemoCodes([...rows, { no: String(maxNo + 1), ...next }])
    setForm(emptyForm)
    setAddOpen(false)
  }

  const startEdit = row => {
    setEditingCode(row.code)
    setEditing({ code: row.code, name: row.name, use: row.use, owner: row.owner })
  }

  const saveEdit = async originalCode => {
    const next = normalizeForm(editing || {})
    if (!next.code || !next.name) return
    if (next.code !== originalCode && rows.some(row => row.code === next.code)) {
      alert('이미 등록된 메모코드입니다.')
      return
    }
    await saveMemoCodes(rows.map(row => row.code === originalCode ? { ...row, ...next } : row))
    setEditingCode(null)
    setEditing(null)
  }

  const cancelEdit = () => {
    setEditingCode(null)
    setEditing(null)
  }

  const tableWidth = Object.values(widths).reduce((sum, width) => sum + width, 0)

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--bg)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>설정</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            메모코드 {rows.length.toLocaleString()}건 · 사용 {activeCount.toLocaleString()}건
            {loading && ' · 불러오는 중'}
            {error && ' · 저장소 연결 오류'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={useFilter} onChange={e => setUseFilter(e.target.value)} style={controlStyle}>
            <option value="전체">전체</option>
            <option value="Y">사용</option>
            <option value="N">미사용</option>
          </select>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="코드, 코드명, 등록자 검색"
            style={{ ...controlStyle, width: 220 }}
          />
          <button onClick={() => setAddOpen(v => !v)} style={primaryButton}>
            추가
          </button>
        </div>
      </div>

      {addOpen && (
        <EditPanel
          data={form}
          setData={setForm}
          onCancel={() => { setAddOpen(false); setForm(emptyForm) }}
          onSave={handleAdd}
          saveText="추가"
        />
      )}

      <section style={{ border: '1px solid var(--border)', background: 'var(--bg2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: 38, padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>메모코드</span>
          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>{filtered.length.toLocaleString()}</span>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: tableWidth, minWidth: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg4)', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                {COLUMNS.map(col => (
                  <Th key={col.key} width={widths[col.key]} active={sort.key === col.key} dir={sort.dir} onClick={() => handleSort(col.key)} onResize={e => startResize(e, col.key)}>
                    {col.label}
                  </Th>
                ))}
                <Th width={widths.actions} onResize={e => startResize(e, 'actions')}>작업</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const isEditing = editingCode === row.code
                return (
                  <tr key={`${row.no}-${row.code}`} style={{ background: idx % 2 ? 'var(--bg2)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <Td width={widths.no} muted>{row.no}</Td>
                    <Td width={widths.code} mono strong>
                      {isEditing ? <Input value={editing.code} onChange={v => setEditing(p => ({ ...p, code: v }))} maxLength={3} /> : row.code}
                    </Td>
                    <Td width={widths.name} strong>
                      {isEditing ? <Input value={editing.name} onChange={v => setEditing(p => ({ ...p, name: v }))} /> : row.name}
                    </Td>
                    <Td width={widths.use}>
                      {isEditing ? (
                        <SelectYN value={editing.use} onChange={v => setEditing(p => ({ ...p, use: v }))} />
                      ) : <UseBadge value={row.use} />}
                    </Td>
                    <Td width={widths.owner}>
                      {isEditing ? <Input value={editing.owner} onChange={v => setEditing(p => ({ ...p, owner: v }))} /> : row.owner}
                    </Td>
                    <Td width={widths.actions}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(row.code)} style={smallPrimary}>저장</button>
                          <button onClick={cancelEdit} style={smallButton}>취소</button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(row)} style={smallButton}>수정</button>
                      )}
                    </Td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function EditPanel({ data, setData, onCancel, onSave, saveText }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(180px, 1fr) 90px 120px auto', gap: 8, alignItems: 'center', marginBottom: 12, padding: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <Input value={data.code} onChange={v => setData(p => ({ ...p, code: v }))} placeholder="코드" maxLength={3} />
      <Input value={data.name} onChange={v => setData(p => ({ ...p, name: v }))} placeholder="메모코드명" />
      <SelectYN value={data.use} onChange={v => setData(p => ({ ...p, use: v }))} />
      <Input value={data.owner} onChange={v => setData(p => ({ ...p, owner: v }))} placeholder="등록자명" />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onSave} style={smallPrimary}>{saveText}</button>
        <button onClick={onCancel} style={smallButton}>취소</button>
      </div>
    </div>
  )
}

function Th({ children, width, active, dir, onClick, onResize }) {
  return (
    <th onClick={onClick} style={{ position: 'relative', width, padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}>
      {children}{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
      <span onMouseDown={onResize} onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: -5, width: 10, height: '100%', cursor: 'col-resize', zIndex: 2 }} />
    </th>
  )
}

function Td({ children, width, muted, mono, strong }) {
  return (
    <td style={{
      width,
      padding: '8px 12px',
      color: muted ? 'var(--text3)' : 'var(--text)',
      fontWeight: strong ? 700 : 400,
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxSizing: 'border-box',
    }}>
      {children}
    </td>
  )
}

function Input({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{ width: '100%', height: 26, boxSizing: 'border-box', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '0 8px', outline: 'none' }}
    />
  )
}

function SelectYN({ value, onChange }) {
  return (
    <select value={value || 'Y'} onChange={e => onChange(e.target.value)} style={{ width: '100%', height: 26, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '0 6px', outline: 'none' }}>
      <option value="Y">Y</option>
      <option value="N">N</option>
    </select>
  )
}

function UseBadge({ value }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 20,
      borderRadius: 4,
      background: value === 'Y' ? 'rgba(22,163,74,.12)' : 'rgba(139,144,171,.12)',
      color: value === 'Y' ? 'var(--green)' : 'var(--text3)',
      fontSize: 11,
      fontWeight: 800,
    }}>
      {value}
    </span>
  )
}

const controlStyle = {
  height: 30,
  boxSizing: 'border-box',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text2)',
  fontSize: 12,
  padding: '0 8px',
  outline: 'none',
}

const primaryButton = {
  height: 30,
  padding: '0 14px',
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
}

const smallButton = {
  height: 26,
  padding: '0 9px',
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
}

const smallPrimary = {
  ...smallButton,
  background: 'var(--accent)',
  border: 'none',
  color: '#fff',
}
