import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function PromotionCodeInput({ value, onChange, onSave, codes, label }) {
  const input = useRef(null)
  const [selectedText, setSelectedText] = useState(null)
  const listId = useId()
  const [position, setPosition] = useState(null)
  const [active, setActive] = useState(0)
  const query = String(value || '').trim().toLowerCase()
  const matches = query ? [
    ...codes.filter(item => item.code.toLowerCase().startsWith(query)),
    ...codes.filter(item => !item.code.toLowerCase().startsWith(query) && item.searchText.includes(query)),
  ].slice(0, 20) : []
  const open = () => {
    const box = input.current.getBoundingClientRect()
    const below = window.innerHeight - box.bottom
    setPosition({ position: 'fixed', left: box.left, width: Math.min(box.width, window.innerWidth - box.left - 8), maxHeight: Math.min(300, Math.max(120, (below >= 180 ? below : box.top) - 16)), ...(below >= 180 ? { top: box.bottom + 4 } : { bottom: window.innerHeight - box.top + 4 }) })
  }
  useEffect(() => {
    const close = event => { if (!event.target.closest?.('.promotion-code-list')) setPosition(null) }
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); document.removeEventListener('scroll', close, true) }
  }, [])
  const select = item => {
    const text = item?.code || String(value || '').trim()
    setSelectedText(text)
    onChange(text)
    setPosition(null)
    onSave(text)
  }
  const visible = position && query
  return (
    <>
      <input ref={input} type="text" role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={!!visible} aria-controls={visible ? listId : undefined} aria-activedescendant={visible && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off" placeholder="편성코드명 검색 또는 직접 입력" value={value}
        onFocus={() => { setSelectedText(null); open() }} onChange={event => { setSelectedText(null); onChange(event.target.value); setActive(0); open() }}
        onBlur={() => { setPosition(null); if (selectedText === null) onSave(String(value || '').trim()) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape') { setPosition(null); return }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!visible) open()
            if (matches.length) setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            if (event.key === 'Enter') event.preventDefault()
            if (visible && matches[active]) select(matches[active])
            else if (event.key === 'Enter') select(null)
          }
        }} />
      {visible && createPortal(
        <div id={listId} role="listbox" className="promotion-code-list" style={position}>
          {matches.length ? matches.map((item, index) => (
            <div key={item.id} id={`${listId}-${index}`} role="option" aria-selected={active === index} className={active === index ? 'is-active' : ''}
              onMouseEnter={() => setActive(index)} onPointerDown={event => { event.preventDefault(); select(item) }}>
              <span>{item.code}</span><small>{item.category}</small>
            </div>
          )) : <div role="option" aria-selected="false" onPointerDown={event => { event.preventDefault(); select(null) }}><span>{value}</span><small>직접 입력</small></div>}
        </div>, document.body,
      )}
    </>
  )
}
