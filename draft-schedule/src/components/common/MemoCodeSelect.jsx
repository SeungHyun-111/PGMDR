import { useEffect, useMemo, useRef, useState } from 'react'
import useMemoCodes from '../../hooks/useMemoCodes'

export default function MemoCodeSelect({
  value,
  onChange,
  onCommit,
  style,
  inputStyle,
  placeholder = '메모코드 검색',
  activeOnly = true,
  autoFocus = false,
}) {
  const { memoCodes, loading } = useMemoCodes({ activeOnly })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef(null)

  useEffect(() => {
    if (!open) setQuery(value || '')
  }, [value, open])

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? memoCodes.filter(row =>
          [row.name, row.code, row.owner].join(' ').toLowerCase().includes(q)
        )
      : memoCodes
    return list.slice(0, 80)
  }, [memoCodes, query])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  const commit = nextValue => {
    onChange(nextValue)
    onCommit?.(nextValue)
    setQuery(nextValue)
    setOpen(false)
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setOpen(false)
      setQuery(value || '')
    }, 120)
  }

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setOpen(true)
  }

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <input
        autoFocus={autoFocus}
        value={query}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setHighlight(prev => Math.min(prev + 1, Math.max(0, options.length - 1)))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(prev => Math.max(0, prev - 1))
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            if (open && options[highlight]) commit(options[highlight].name)
            else commit(query.trim())
          }
          if (e.key === 'Escape') {
            setOpen(false)
            setQuery(value || '')
          }
        }}
        placeholder={placeholder}
        style={inputStyle}
      />
      {open && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 4px)',
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
            borderRadius: 6,
            boxShadow: '0 10px 28px rgba(0,0,0,.28)',
            zIndex: 10020,
          }}
        >
          {loading ? (
            <div style={emptyStyle}>불러오는 중...</div>
          ) : options.length ? options.map((row, idx) => (
            <button
              key={`${row.code}-${row.name}`}
              type="button"
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => commit(row.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                minHeight: 30,
                padding: '6px 9px',
                border: 'none',
                borderBottom: idx === options.length - 1 ? 'none' : '1px solid var(--border)',
                background: idx === highlight ? 'rgba(74,108,247,.14)' : 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
              <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>{row.code}</span>
            </button>
          )) : (
            <div style={emptyStyle}>검색 결과가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}

const emptyStyle = {
  padding: '12px 10px',
  color: 'var(--text3)',
  fontSize: 12,
  textAlign: 'center',
}
