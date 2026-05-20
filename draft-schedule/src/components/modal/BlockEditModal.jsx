import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'

const labelStyle = { fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 4, display: 'block' }

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={labelStyle}>
        {label}
        {hint && <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export default function BlockEditModal({ block, onSave, onClose }) {
  const { proposalItems, performanceRows } = useScheduleStore.getState()

  const proposalItem = proposalItems.find(p => p.itemId === block.itemId) || {}

  const lastPerf = performanceRows
    .filter(p => p.pgmCodeName === block.pgmCodeName)
    .sort((a, b) => String(b.broadcastDate).replace(/\D/g,'').localeCompare(String(a.broadcastDate).replace(/\D/g,'')))[0] || null

  const [form, setForm] = useState({
    pgmCodeName:                  block.pgmCodeName || '',
    channel:                      block.channel || 'ALL',
    dealType:                     block.dealType || proposalItem.dealType || '',
    mdCategory:                   block.mdCategory || proposalItem.mdCategory || '',
    videoStatus:                  block.videoStatus || proposalItem.videoStatus || '',
    memoCode:                     block.memoCode || '',
    scheduleComment:              block.scheduleComment || '',
    expectedSalesPerWeightedMin:  block.expectedSalesPerWeightedMin  ?? lastPerf?.salesPerWeightedMin  ?? '',
    expectedProfitPerWeightedMin: block.expectedProfitPerWeightedMin ?? lastPerf?.profitPerWeightedMin ?? '',
    mixedCostPerMin:              block.mixedCostPerMin || proposalItem.fixedFee || '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleChannel = (ch) => setForm(f => ({ ...f, channel: ch }))

  const handleSave = () => {
    onSave({
      ...form,
      expectedSalesPerWeightedMin:  Number(form.expectedSalesPerWeightedMin)  || 0,
      expectedProfitPerWeightedMin: Number(form.expectedProfitPerWeightedMin) || 0,
      mixedCostPerMin:              Number(form.mixedCostPerMin) || 0,
    })
  }

  const inp = {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '7px 10px', borderRadius: 5, fontSize: 12, width: '100%'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', width: 480, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>블록 수정</div>

        <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: 'var(--text2)' }}>
          {block.dateKey} {block.timeText} · {block.durationMin}분 · 가중분 {block.weightedMin}
        </div>

        <Field label="채널">
          <div style={{ display: 'flex', gap: 8 }}>
            {['CA', 'IP', 'ALL'].map(ch => (
              <button key={ch} onClick={() => handleChannel(ch)} style={{
                flex: 1, padding: '7px 0', borderRadius: 5, border: '1px solid', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: form.channel === ch ? (ch === 'CA' ? 'var(--ca2)' : ch === 'IP' ? 'var(--ip2)' : 'var(--all2)') : 'var(--bg4)',
                borderColor: form.channel === ch ? 'transparent' : 'var(--border)',
                color: form.channel === ch ? '#fff' : 'var(--text2)'
              }}>{ch}</button>
            ))}
          </div>
        </Field>

        <Field label="편성코드명">
          <input name="pgmCodeName" value={form.pgmCodeName} onChange={handleChange} style={inp} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="거래형태" hint={proposalItem.dealType ? `원본: ${proposalItem.dealType}` : ''}>
            <input name="dealType" value={form.dealType} onChange={handleChange} style={inp} placeholder="위탁, 구매..." />
          </Field>
          <Field label="카테고리" hint={proposalItem.mdCategory ? `원본: ${proposalItem.mdCategory}` : ''}>
            <input name="mdCategory" value={form.mdCategory} onChange={handleChange} style={inp} placeholder="카테고리 입력" />
          </Field>
          <Field label="영상구분" hint={proposalItem.videoStatus ? `원본: ${proposalItem.videoStatus}` : ''}>
            <input name="videoStatus" value={form.videoStatus} onChange={handleChange} style={inp} placeholder="신규, 재활용..." />
          </Field>
          <Field label="분당혼합비용" hint={proposalItem.fixedFee ? `원본: ${Number(proposalItem.fixedFee).toLocaleString()}` : ''}>
            <input name="mixedCostPerMin" type="number" value={form.mixedCostPerMin} onChange={handleChange} style={inp} placeholder="0" />
          </Field>
        </div>

        {lastPerf && (
          <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '8px 12px', fontSize: 11 }}>
            <div style={{ color: 'var(--text3)', marginBottom: 4 }}>직전 실적 참고 ({lastPerf.broadcastDate} {lastPerf.broadcastTime})</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ color: 'var(--text2)' }}>가중분당취급액 <strong style={{ color: 'var(--accent)' }}>{Number(lastPerf.salesPerWeightedMin).toLocaleString()}</strong></span>
              <span style={{ color: 'var(--text2)' }}>가중분당한계이익 <strong style={{ color: 'var(--green)' }}>{Number(lastPerf.profitPerWeightedMin).toLocaleString()}</strong></span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="예상 가중분당취급액" hint="직접 입력 시 우선 적용">
            <input name="expectedSalesPerWeightedMin" type="number" value={form.expectedSalesPerWeightedMin} onChange={handleChange} style={inp} placeholder={lastPerf?.salesPerWeightedMin || '0'} />
          </Field>
          <Field label="예상 가중분당한계이익" hint="직접 입력 시 우선 적용">
            <input name="expectedProfitPerWeightedMin" type="number" value={form.expectedProfitPerWeightedMin} onChange={handleChange} style={inp} placeholder={lastPerf?.profitPerWeightedMin || '0'} />
          </Field>
        </div>

        <Field label="메모코드">
          <input name="memoCode" value={form.memoCode} onChange={handleChange} style={inp} placeholder="[전사블록]" />
        </Field>

        <Field label="편성C (코멘트)">
          <textarea name="scheduleComment" value={form.scheduleComment} onChange={handleChange} rows={3}
            placeholder="편성 관련 코멘트..." style={{ ...inp, resize: 'vertical' }} />
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} style={{ flex: 2, padding: '9px 0', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
        </div>
      </div>
    </div>
  )
}