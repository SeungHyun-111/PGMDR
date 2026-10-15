import { useEffect, useRef } from 'react'

export default function PromotionOrganizationFilter({ options, selected, onChange, label = '조직명' }) {
  const root = useRef(null)
  useEffect(() => {
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && root.current?.contains(event.target)) return
      if (root.current) root.current.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [])
  return (
    <details ref={root} className="promotion-org-filter">
      <summary>{label} <strong>{selected.length ? `${selected.length}개 선택` : '전체'}</strong></summary>
      <div className="promotion-org-options" role="group" aria-label={`${label} 다중 선택`}>
        <div className="promotion-org-options-header"><span>{label} 다중 선택</span><button type="button" onClick={() => onChange([])}>전체 보기</button></div>
        {options.map(name => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={event => onChange(event.target.checked ? [...selected, name] : selected.filter(item => item !== name))} /><span>{name}</span></label>)}
        {!options.length && <p>목록에 해당하는 {label}이 없습니다.</p>}
      </div>
    </details>
  )
}
