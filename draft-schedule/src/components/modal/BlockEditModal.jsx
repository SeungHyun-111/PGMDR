// src/components/modal/BlockEditModal.jsx
import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { DEAL_TYPES } from '../../constants/dealTypes'
import { CATEGORIES } from '../../constants/categories'
import { CHANNELS } from '../../constants/channels'
import { makePerfKey } from '../../hooks/usePerformanceMap'
import { normalizeTeamName } from '../../utils/teamName'
import { extractEntityFields } from '../../utils/mergeEntity'
import { getManualInputKey } from '../../utils/grade'
import MemoCodeSelect from '../common/MemoCodeSelect'

const inp = { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 9px', borderRadius: 5, fontSize: 12, width: '100%' }

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

export default function BlockEditModal({ block, onClose, saveBlock }) {
  const { perfMap, manualInputs, saveManualInput, saveEntityProps, removeBlock, changeBlockChannel, weightedMinTargets, runUndoBatch } = useScheduleStore()
  const blockKey = block.blockKey || block.slotId

  const initDealType = block.dealTypeConverted || block.dealType || ''
  const [form, setForm] = useState({
    pgmCodeName:       block.pgmCodeName       || '',
    mdTeam:            normalizeTeamName(block.mdTeam || block.orgName || '', weightedMinTargets),
    mdCategory:        block.mdCategory        || '',
    dealType:          initDealType,
    dealTypeConverted: initDealType,
    channel:           block.channel           || 'ALL',
    newProductType:    block.newProductType    || '',
    timeText:          block.timeText          || '',
    memoCode:          block.memoCode          || '',
    requestNote:       block.requestNote       || '',
    scheduleComment:   block.scheduleComment   || '',
    annotation:        block.annotation        || '',
  })

  const teamNames = weightedMinTargets.map(t => t.teamName).filter(Boolean)

  const currentPerfKey = makePerfKey(form.dealTypeConverted || form.dealType, form.pgmCodeName)
  const lastPerf = currentPerfKey ? (perfMap[currentPerfKey] || null) : null

  const manualKey = getManualInputKey(block)
  const manual = manualKey ? (manualInputs[manualKey] || {}) : {}
  const [manualSales,  setManualSales]  = useState(manual.expectedSalesPerWeightedMin  ?? '')
  const [manualProfit, setManualProfit] = useState(manual.expectedProfitPerWeightedMin ?? '')
  const [saveState, setSaveState] = useState('idle')
  const [channelConflict, setChannelConflict] = useState(null)

  const setField = (key, val) => setForm(prev => {
    const next = { ...prev, [key]: val }
    if (key === 'dealType') next.dealTypeConverted = val
    return next
  })

  const buildEntityPatch = () => {
    const dealTypeConverted = form.dealTypeConverted || form.dealType
    const perfKey = makePerfKey(dealTypeConverted, form.pgmCodeName)
    return extractEntityFields({
      ...form,
      dealTypeConverted,
      orgName: form.mdTeam,
      ...(perfKey ? { perfKey } : {}),
    })
  }

  const persistEntityAndManual = async (entityPatch) => {
    if (block.uniqueKey) {
      await saveEntityProps(block.uniqueKey, entityPatch)
    } else {
      await saveBlock(blockKey, entityPatch)
    }
    if (manualKey) {
      await saveManualInput(manualKey, {
        expectedSalesPerWeightedMin:  manualSales  === '' ? null : Number(manualSales),
        expectedProfitPerWeightedMin: manualProfit === '' ? null : Number(manualProfit),
      })
    }
  }

  const commitSave = async (channelMode) => {
    if (saveState !== 'idle') return
    setSaveState('saving')
    try {
      let blockedByConflict = false
      await runUndoBatch(`블록 수정 되돌리기: ${form.pgmCodeName || block.pgmCodeName || blockKey}`, async () => {
      const entityPatch = buildEntityPatch()

      // 슬롯 필드만 scheduleBlocks에 저장 (채널 변경 포함)
      const origChannel = block.blockKey?.endsWith('_CA') ? 'CA'
        : block.blockKey?.endsWith('_IP') ? 'IP' : 'ALL'

      if (form.channel !== origChannel) {
        const result = await changeBlockChannel(
          block,
          form.channel,
          { channel: form.channel, isDefault: false },
          channelMode ? { mode: channelMode } : {}
        )
        if (result?.conflict) {
          setChannelConflict({ ...result, entityPatch })
          setSaveState('idle')
          blockedByConflict = true
          return
        }
      } else {
        await saveBlock(blockKey, { channel: form.channel, isDefault: false })
      }

      await persistEntityAndManual(entityPatch)
      })
      if (blockedByConflict) return

      setSaveState('saved')
      setTimeout(onClose, 700)
    } catch {
      setSaveState('idle')
    }
  }

  const handleSave = () => commitSave()

  const resolveChannelConflict = async (mode) => {
    if (!channelConflict || saveState !== 'idle') return
    setSaveState('saving')
    try {
      await runUndoBatch(`채널 변경 되돌리기: ${form.pgmCodeName || block.pgmCodeName || blockKey}`, async () => {
      const result = await changeBlockChannel(
        block,
        form.channel,
        { channel: form.channel, isDefault: false },
        { mode }
      )
      if (result?.conflict) {
        setSaveState('idle')
        return
      }
      await persistEntityAndManual(channelConflict.entityPatch)
      })
      setChannelConflict(null)
      setSaveState('saved')
      setTimeout(onClose, 700)
    } catch {
      setSaveState('idle')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('이 블록을 편성표에서 제거하시겠습니까?')) return
    await runUndoBatch(`블록 삭제 되돌리기: ${block.pgmCodeName || blockKey}`, () => removeBlock(blockKey))
    onClose()
  }

  const fmt = v => Number(v || 0).toLocaleString()

  return (
    // 배경 클릭 시에만 닫힘 (모달 내부 클릭으로 인한 의도치 않은 닫힘 방지)
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div
        style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px 28px', width: 500, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>

        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>블록 수정</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, background: 'var(--bg3)', padding: '6px 10px', borderRadius: 5 }}>
          {block.dateKey} {block.timeText} · {block.durationMin}분 · 가중분 {block.weightedMin}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="편성코드명">
            <input value={form.pgmCodeName} onChange={e => setField('pgmCodeName', e.target.value)} style={inp} />
          </Field>
          <Field label="팀명">
            {teamNames.length > 0 ? (
              <select value={form.mdTeam} onChange={e => setField('mdTeam', e.target.value)} style={inp}>
                <option value="">선택</option>
                {teamNames.map(t => <option key={t} value={t}>{t}</option>)}
                {form.mdTeam && !teamNames.includes(form.mdTeam) && (
                  <option value={form.mdTeam}>{form.mdTeam}</option>
                )}
              </select>
            ) : (
              <input value={form.mdTeam} onChange={e => setField('mdTeam', e.target.value)} style={inp} />
            )}
          </Field>
          <Field label="거래형태">
            <select value={form.dealType} onChange={e => setField('dealType', e.target.value)} style={inp}>
              <option value="">선택</option>
              {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="카테고리">
            <select value={form.mdCategory} onChange={e => setField('mdCategory', e.target.value)} style={inp}>
              <option value="">선택</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="채널">
            <select value={form.channel} onChange={e => setField('channel', e.target.value)} style={inp}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="신상품구분">
            <select value={form.newProductType} onChange={e => setField('newProductType', e.target.value)} style={inp}>
              <option value="">선택</option>
              {['기존', '신상품', '재녹화', '재편집'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="시작시간">
            <input value={form.timeText} onChange={e => setField('timeText', e.target.value)}
              placeholder="예: 23:21" style={inp} />
          </Field>
          <Field label="메모코드">
            <MemoCodeSelect
              value={form.memoCode}
              onChange={value => setField('memoCode', value)}
              inputStyle={inp}
            />
          </Field>
        </div>

        <Field label="편성C">
          <textarea value={form.scheduleComment} onChange={e => setField('scheduleComment', e.target.value)} rows={2}
            placeholder="# 포함 시 블록에 표시" style={{ ...inp, resize: 'vertical' }} />
        </Field>
        <Field label="기타요청사항">
          <textarea value={form.requestNote} onChange={e => setField('requestNote', e.target.value)} rows={2}
            style={{ ...inp, resize: 'vertical' }} />
        </Field>
        <Field label="첨삭">
          <textarea value={form.annotation} onChange={e => setField('annotation', e.target.value)} rows={2}
            style={{ ...inp, resize: 'vertical' }} />
        </Field>

        <div style={{ background: 'var(--bg3)', borderRadius: 6, padding: '10px 12px', marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
            직전 실적
            {lastPerf
              ? <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>({lastPerf.broadcastDate} {lastPerf.broadcastTime})</span>
              : <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>— 매칭 없음</span>
            }
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>취급/분</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{fmt(lastPerf?.salesPerWeightedMin)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>한익/분</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{fmt(lastPerf?.profitPerWeightedMin)}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>수동 입력 (비워두면 직전 실적 사용)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="수동 취급/분">
                <input type="number" value={manualSales} onChange={e => setManualSales(e.target.value)}
                  placeholder={fmt(lastPerf?.salesPerWeightedMin)} style={inp} />
              </Field>
              <Field label="수동 한익/분">
                <input type="number" value={manualProfit} onChange={e => setManualProfit(e.target.value)}
                  placeholder={fmt(lastPerf?.profitPerWeightedMin)} style={inp} />
              </Field>
            </div>
          </div>
        </div>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleDelete}
            style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>삭제</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}
            style={{ padding: '8px 14px', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saveState !== 'idle'}
            style={{
              padding: '8px 20px', border: 'none', color: '#fff', borderRadius: 6,
              fontSize: 12, fontWeight: 700,
              background: saveState === 'saved' ? 'var(--green)' : 'var(--accent)',
              cursor: saveState !== 'idle' ? 'default' : 'pointer',
              opacity: saveState === 'saving' ? 0.7 : 1,
              transition: 'background .2s, opacity .2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {saveState === 'saving' && (
              <span style={{ width: 11, height: 11, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTop: '2px solid #fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
            )}
            {saveState === 'saved' ? '✓ 저장됨' : saveState === 'saving' ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
      {channelConflict && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.48)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setChannelConflict(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 420, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '20px 22px', boxShadow: '0 16px 48px rgba(0,0,0,.5)' }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>채널 위치 충돌</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55, marginBottom: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{channelConflict.sourceName}</strong> 상품을 {channelConflict.fromChannel}에서 {channelConflict.toChannel}로 이동하려고 합니다.
              <br />
              {channelConflict.kind === 'merge' ? '합쳐질 반대 채널' : '이동할 채널'}에는 이미 <strong style={{ color: 'var(--text)' }}>{channelConflict.targetName}</strong> 상품이 있습니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => resolveChannelConflict('sidebar')} disabled={saveState !== 'idle'}
                style={{ padding: '9px 12px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saveState === 'idle' ? 'pointer' : 'default', textAlign: 'left' }}>
                기존 상품 사이드바로 보내고 이동
              </button>
              <button onClick={() => resolveChannelConflict('compete')} disabled={saveState !== 'idle'}
                style={{ padding: '9px 12px', background: 'var(--yellow)', border: 'none', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saveState === 'idle' ? 'pointer' : 'default', textAlign: 'left' }}>
                두 상품을 경쟁으로 묶기
              </button>
              {channelConflict.canSwap && (
                <button onClick={() => resolveChannelConflict('swap')} disabled={saveState !== 'idle'}
                  style={{ padding: '9px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saveState === 'idle' ? 'pointer' : 'default', textAlign: 'left' }}>
                  두 상품 위치 맞교환
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setChannelConflict(null)} disabled={saveState !== 'idle'}
                style={{ flex: 1, padding: '8px 0', background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 6, fontSize: 12, cursor: saveState === 'idle' ? 'pointer' : 'default' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
