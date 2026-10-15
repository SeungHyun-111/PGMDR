import { useEffect, useState } from 'react'
import { db, ref, onValue, push, set } from '../api/firebase'
import './PromotionPage.css'
import PromotionDateInput from './PromotionDateInput'
import PromotionProductsTab from './PromotionProductsTab'
import PromotionPerformanceTab from './PromotionPerformanceTab'
import PromotionPgmSelectionTab from './PromotionPgmSelectionTab'

const PROMOTIONS_PATH = 'global/promotions'
function getKoreaToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
}
const buttonStyle = { padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }

export default function PromotionPage() {
  const [activeTab, setActiveTab] = useState('settings')
  const [today, setToday] = useState(getKoreaToday)
  const [promotions, setPromotions] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setToday(getKoreaToday()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => onValue(ref(db, PROMOTIONS_PATH), snapshot => {
    setPromotions(snapshot.val() || {})
    setLoaded(true)
    setError('')
  }, () => {
    setLoaded(false)
    setError('프로모션을 불러오지 못했습니다. 연결 상태를 확인해주세요.')
  }), [])

  const addRow = async () => {
    setAdding(true)
    try {
      await set(push(ref(db, PROMOTIONS_PATH)), { name: '', startDate: '', endDate: '', content: '', topLeft: false, topRight: false, lBar: false, createdAt: Date.now() })
      setError('')
    } catch {
      setError('행 추가에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setAdding(false)
    }
  }
  const rows = Object.entries(promotions).sort(([idA, a], [idB, b]) => (a.createdAt || 0) - (b.createdAt || 0) || idA.localeCompare(idB))
  const monthStart = `${today.slice(0, 7)}-01`
  const nextMonthDate = new Date(`${monthStart}T00:00:00Z`)
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
  const nextMonth = nextMonthDate.toISOString().slice(0, 10)
  const statusOrder = promotion => promotion.endDate < today ? 2 : promotion.startDate > today ? 1 : 0
  const monthlyPromotions = rows.filter(([, promotion]) => promotion.startDate && promotion.endDate && promotion.startDate <= promotion.endDate && promotion.startDate < nextMonth && promotion.endDate >= monthStart)
    .sort(([, a], [, b]) => statusOrder(a) - statusOrder(b) || a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))

  return (
    <div className={`promotion-page${activeTab === 'pgmSelection' ? ' is-pgm-selection' : activeTab === 'performance' ? ' is-promotion-results' : ''}`} aria-label="프로모션" style={{ height: '100%', overflow: 'auto', background: 'var(--bg)' }}>
      <section className="promotion-ongoing" aria-label="이번 달 프로모션">
        <div className="promotion-ongoing-heading">
          <h2>{Number(today.slice(5, 7))}월 프로모션 <span>{monthlyPromotions.length}</span></h2>
          <span>{today} 기준</span>
        </div>
        {monthlyPromotions.length > 0 ? (
          <div className="promotion-ongoing-list">
            {monthlyPromotions.map(([id, promotion], index) => (
              <div key={id} className="promotion-ongoing-item">
                <span className={`promotion-ongoing-badge ${promotion.endDate < today ? 'is-ended' : promotion.startDate > today ? 'is-upcoming' : ''}`}>{promotion.endDate < today ? '종료' : promotion.startDate > today ? '예정' : '진행 중'}</span>
                <strong>{promotion.name || `프로모션 ${index + 1}`}</strong>
                <span className="promotion-ongoing-period">{promotion.startDate} ~ {promotion.endDate}</span>
              </div>
            ))}
          </div>
        ) : <p className="promotion-ongoing-empty">{!loaded ? (error ? '프로모션을 불러오지 못했습니다.' : '프로모션을 불러오는 중입니다.') : '이번 달에 해당하는 프로모션이 없습니다.'}</p>}
      </section>
      <div role="tablist" aria-label="프로모션 관리" style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {[['settings', '프로모션 설정'], ['products', '프로모션 상품'], ['performance', '프로모션 실적'], ['pgmSelection', '프로모션 PGM 선정']].map(([tab, label]) => (
          <button key={tab} id={`promotion-${tab}-tab`} type="button" role="tab" aria-selected={activeTab === tab} aria-controls={`promotion-${tab}-panel`} onClick={() => setActiveTab(tab)}
            style={{ padding: '14px 18px', border: 'none', borderBottom: `2px solid ${activeTab === tab ? (tab === 'performance' ? 'var(--red)' : 'var(--accent)') : 'transparent'}`, background: 'transparent', color: tab === 'performance' ? 'var(--red)' : activeTab === tab ? 'var(--accent)' : 'var(--text3)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <section hidden={activeTab !== 'settings'} id="promotion-settings-panel" role="tabpanel" aria-labelledby="promotion-settings-tab" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--text)' }}>프로모션 설정</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>전체 세션 공통 · 입력 후 다른 칸으로 이동하면 자동 저장됩니다.</p>
          </div>
          <button type="button" onClick={addRow} disabled={!loaded || adding} style={{ ...buttonStyle, opacity: !loaded || adding ? 0.5 : 1 }}>{adding ? '추가 중…' : '+ 행 추가'}</button>
        </div>
        {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table className="promotion-table" style={{ width: '100%', minWidth: 1240, borderCollapse: 'collapse', tableLayout: 'fixed', color: 'var(--text)', fontSize: 13 }}>
            <colgroup><col style={{ width: 56 }} /><col style={{ width: '21%' }} /><col style={{ width: 350 }} /><col /><col style={{ width: 76 }} /><col style={{ width: 76 }} /><col style={{ width: 68 }} /><col style={{ width: 82 }} /></colgroup>
            <thead style={{ background: 'var(--bg3)' }}><tr>{['번호', '프로모션명', '기간', '내용', '좌상단', '우상단', 'L바', '관리'].map(title => <th key={title} style={{ padding: '12px 10px', textAlign: 'left', fontWeight: 700 }}>{title}</th>)}</tr></thead>
            <tbody>
              {rows.map(([id, promotion], index) => <PromotionRow key={id} id={id} promotion={promotion} index={index} />)}
              {!rows.length && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{!loaded ? (error ? '데이터 연결을 확인해주세요.' : '불러오는 중…') : '행 추가 버튼을 눌러 프로모션을 등록하세요.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section hidden={activeTab !== 'products'} id="promotion-products-panel" role="tabpanel" aria-labelledby="promotion-products-tab" style={{ padding: 24 }}>
        <PromotionProductsTab promotions={rows} loaded={loaded} loadError={error} />
      </section>
      <section hidden={activeTab !== 'performance'} id="promotion-performance-panel" role="tabpanel" aria-labelledby="promotion-performance-tab" style={{ padding: 24 }}>
        <PromotionPerformanceTab promotions={rows} loaded={loaded} active={activeTab === 'performance'} />
      </section>
      <section hidden={activeTab !== 'pgmSelection'} id="promotion-pgmSelection-panel" role="tabpanel" aria-labelledby="promotion-pgmSelection-tab" style={{ padding: 24 }}>
        <PromotionPgmSelectionTab promotions={rows} loaded={loaded} active={activeTab === 'pgmSelection'} />
      </section>
    </div>
  )
}

function PromotionRow({ id, promotion, index }) {
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const save = async (field, value) => {
    try {
      await set(ref(db, `${PROMOTIONS_PATH}/${id}/${field}`), value)
      setError('')
      return true
    } catch {
      setError('저장에 실패했습니다. 입력 칸을 다시 선택한 뒤 이동하면 재시도합니다.')
      return false
    }
  }
  const deleteRow = async () => {
    if (!window.confirm('이 프로모션과 연결된 적용 상품을 모두 삭제할까요?')) return
    setDeleting(true)
    try {
      await set(ref(db, `${PROMOTIONS_PATH}/${id}`), null)
    } catch {
      setError('삭제에 실패했습니다. 다시 시도해주세요.')
      setDeleting(false)
    }
  }
  const cellStyle = { padding: '14px 10px', verticalAlign: 'middle', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }
  return (
    <tr>
      <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--text3)' }}>{index + 1}</td>
      <td style={cellStyle}><PromotionCell value={promotion.name} label={`${index + 1}행 프로모션명`} onSave={value => save('name', value)} /></td>
      <td style={cellStyle}>
        <div className="promotion-period">
          <PromotionDateInput value={promotion.startDate} max={promotion.endDate || undefined} label={`${index + 1}행 시작일`} onSave={value => save('startDate', value)} />
          <span>~</span>
          <PromotionDateInput value={promotion.endDate} min={promotion.startDate || undefined} label={`${index + 1}행 종료일`} onSave={value => save('endDate', value)} />
        </div>
      </td>
      <td style={cellStyle}>
        <PromotionCell multiline value={promotion.content} label={`${index + 1}행 내용`} onSave={value => save('content', value)} />
        {error && <p role="alert" style={{ margin: '6px 0 0', color: 'var(--red)', fontSize: 12 }}>{error}</p>}
      </td>
      {[['topLeft', '좌상단'], ['topRight', '우상단'], ['lBar', 'L바']].map(([field, label]) => (
        <td key={field} style={{ ...cellStyle, textAlign: 'center' }}>
          <input className="promotion-checkbox" type="checkbox" aria-label={`${index + 1}행 ${label}`} checked={!!promotion[field]} onChange={event => save(field, event.target.checked)} />
        </td>
      ))}
      <td style={cellStyle}><button type="button" disabled={deleting} onClick={deleteRow} style={{ ...buttonStyle, color: 'var(--red)', padding: '8px 10px' }}>{deleting ? '삭제 중' : '삭제'}</button></td>
    </tr>
  )
}

function PromotionCell({ value = '', label, onSave, multiline = false, ...props }) {
  const [draft, setDraft] = useState(null)
  const current = draft ?? value
  const handleBlur = async event => {
    if (!event.target.checkValidity()) {
      event.target.reportValidity()
      return
    }
    if (draft !== null) {
      // Keep the draft until the write succeeds so a failed save remains retryable.
      const saved = await onSave(current)
      if (saved) setDraft(previous => previous === current ? null : previous)
    }
  }
  const common = { ...props, 'aria-label': label, value: current, onChange: event => setDraft(event.target.value), onBlur: handleBlur, onFocus: () => { if (draft === value) setDraft(null) }, style: { ...inputStyle, minWidth: 0 } }
  return multiline ? <textarea {...common} rows={1} /> : <input {...common} />
}
