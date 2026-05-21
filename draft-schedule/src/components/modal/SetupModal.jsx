import { useState } from 'react'

export default function SetupModal({ onClose, onSubmit }) {
  const [startDate, setStartDate] = useState('')
  const [poolType, setPoolType] = useState('A')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!startDate) return alert('시작일자를 선택해주세요.')
    const d = new Date(startDate + 'T00:00:00')
    if (d.getDay() !== 1) return alert('시작일자는 반드시 월요일이어야 합니다.')
    setLoading(true)
    localStorage.setItem('lastWeekKey', `${startDate}_${poolType}`)
    await onSubmit(startDate, poolType)
  }

  const inp = { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 6, fontSize: 13 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 360 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>새 편성 시작</div>
        <div style={{ fontSize: 11, color: 'var(--yellow)', background: 'rgba(245,200,66,.08)', padding: '8px 12px', borderRadius: 6 }}>
          ⚠ 기존 편성 작업 데이터가 초기화됩니다.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>시작일자 (월요일)</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>풀 선택</label>
          <select value={poolType} onChange={e => setPoolType(e.target.value)} style={inp}>
            <option value="A">풀 A</option>
            <option value="B">풀 B</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '10px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: '10px 0', background: loading ? 'var(--bg4)' : 'var(--accent)', border: 'none', color: loading ? 'var(--text3)' : '#fff', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
            {loading ? '불러오는 중...' : '불러오기'}
          </button>
        </div>
      </div>
    </div>
  )
}