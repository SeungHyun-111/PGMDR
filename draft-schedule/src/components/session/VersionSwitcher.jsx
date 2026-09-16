import { useEffect, useRef, useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { db, ref, get } from '../../api/firebase'
import { OPS_CONFLICT_KEEP_CURRENT, OPS_CONFLICT_USE_SOURCE } from '../../domain/ops/opsOverlay'
import { SESSION_VERSIONS, VERSION_DRAFT, VERSION_OPS, VERSION_SALES, getVersionLabel } from '../../utils/sessionVersion'

const btnBase = {
  border: '1px solid var(--border)',
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  height: 26,
}

const VERSION_TONES = {
  [VERSION_DRAFT]: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', activeBg: '#2563eb', activeColor: '#fff' },
  [VERSION_SALES]: { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', activeBg: '#ea580c', activeColor: '#fff' },
  [VERSION_OPS]: { bg: '#ecfdf5', border: '#86efac', color: '#15803d', activeBg: '#16a34a', activeColor: '#fff' },
}

const ACTION_TONE = {
  bg: '#fff1f2',
  border: '#fda4af',
  color: '#be123c',
  hoverBg: '#ffe4e6',
}

const formatMetaTime = ts => {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '-'
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function VersionSwitcher({ onToast, coachPreviewVersion = null }) {
  const [isSyncingOps, setIsSyncingOps] = useState(false)
  const [conflictChoices, setConflictChoices] = useState({})
  const {
    startDate,
    poolType,
    currentVersionId,
    versionMeta,
    setSessionVersion,
    syncOpsVersionFromGas,
    resolveOpsSyncConflicts,
    opsSyncConflicts,
    publishSalesVersion,
    isPublishingSales,
  } = useScheduleStore()

  const salesPublishedAt = versionMeta?.[VERSION_SALES]?.publishedAt
  const opsPublishedAt = versionMeta?.[VERSION_OPS]?.publishedAt || versionMeta?.[VERSION_OPS]?.updatedAt
  const displayVersionId = coachPreviewVersion || currentVersionId
  const actionMeta = displayVersionId === VERSION_DRAFT
    ? versionMeta?.[VERSION_SALES]
    : versionMeta?.[VERSION_OPS]
  const didInitSalesNoticeRef = useRef(false)
  const previousSalesPublishedAtRef = useRef(salesPublishedAt)

  useEffect(() => {
    if (!didInitSalesNoticeRef.current) {
      didInitSalesNoticeRef.current = true
      previousSalesPublishedAtRef.current = salesPublishedAt
      return
    }

    if (!previousSalesPublishedAtRef.current && salesPublishedAt) {
      onToast?.('영업팀 공유본이 생성되었습니다.')
    }
    previousSalesPublishedAtRef.current = salesPublishedAt
  }, [onToast, salesPublishedAt])

  const handleSelect = async (versionId) => {
    if (versionId === currentVersionId) return
    if (versionId === VERSION_SALES) {
      let latestSalesMeta = salesPublishedAt ? versionMeta?.[VERSION_SALES] : null

      if (!latestSalesMeta && startDate && poolType) {
        const weekKey = `${startDate}_${poolType}`
        const snap = await get(ref(db, `sessions/${weekKey}/versionMeta/${VERSION_SALES}`))
        latestSalesMeta = snap.exists() ? snap.val() : null
        if (latestSalesMeta) {
          useScheduleStore.setState(state => ({
            versionMeta: {
              ...(state.versionMeta || {}),
              [VERSION_SALES]: latestSalesMeta,
            },
          }))
        }
      }

      if (!latestSalesMeta?.publishedAt) {
        alert('영업팀 공유본이 아직 없습니다. 담당작성에서 먼저 공유본을 생성하세요.')
        return
      }
    }
    await setSessionVersion(versionId)
  }

  const handlePublish = async () => {
    if (currentVersionId !== VERSION_DRAFT) {
      alert('초안 확정은 담당 작성 버전에서만 가능합니다.')
      return
    }
    const msg = salesPublishedAt
      ? '현재 담당 작성본으로 영업팀 공유본을 덮어쓸까요?'
      : '현재 담당 작성본으로 영업팀 공유본을 생성할까요?'
    if (!window.confirm(msg)) return
    await publishSalesVersion()
    onToast?.('초안 확정 완료')
  }

  const handleOpsPrepare = () => {
    alert('편성 확정 기능은 Google 웹앱 연동 후 연결합니다.')
  }

  const handleLoadCurrentSchedule = async () => {
    if (!startDate || !poolType) {
      alert('먼저 세션을 선택하세요.')
      return
    }
    if (!window.confirm('Google 편성운영 시트에서 현재 편성운영 버전을 갱신할까요?')) return
    setIsSyncingOps(true)
    try {
      const result = await syncOpsVersionFromGas()
      const conflictCount = result?.conflicts?.length || 0
      onToast?.(conflictCount ? `편성운영 갱신 완료 · 충돌 ${conflictCount}건` : '편성운영 갱신 완료')
    } catch (e) {
      alert(e?.message || '편성운영 갱신에 실패했습니다.')
    } finally {
      setIsSyncingOps(false)
    }
  }

  const getActionLabel = () => {
    if (displayVersionId === VERSION_DRAFT) return isPublishingSales ? '확정 중...' : '초안 확정'
    if (displayVersionId === VERSION_SALES) return '편성 확정'
    if (displayVersionId === VERSION_OPS) return isSyncingOps ? '갱신 중...' : '버전 갱신'
    return '버전 갱신'
  }

  const handleVersionAction = () => {
    if (currentVersionId === VERSION_DRAFT) return handlePublish()
    if (currentVersionId === VERSION_SALES) return handleOpsPrepare()
    return handleLoadCurrentSchedule()
  }

  const isVersionDisabled = (versionId) => {
    if (coachPreviewVersion) return false
    return false
  }

  const getVersionTitle = (versionId) => {
    if (versionId === VERSION_SALES && !salesPublishedAt) return '공유본 없음'
    if (versionId === VERSION_OPS) return opsPublishedAt ? getVersionLabel(versionId) : '편성운영본 없음'
    return getVersionLabel(versionId)
  }

  const actionTimeText = formatMetaTime(actionMeta?.publishedAt || actionMeta?.updatedAt)
  const actionUserText = actionMeta?.publishedBy || actionMeta?.updatedBy || '-'
  const fieldConflicts = (opsSyncConflicts || []).filter(conflict => conflict.type === 'field')
  const ambiguousConflicts = (opsSyncConflicts || []).filter(conflict => conflict.type === 'ambiguous')

  const chooseAll = async (choice) => {
    const resolutions = Object.fromEntries(fieldConflicts.map(conflict => [conflict.id, choice]))
    await resolveOpsSyncConflicts(resolutions)
    setConflictChoices({})
    onToast?.(choice === OPS_CONFLICT_USE_SOURCE ? '신규값 적용 완료' : '현재값 유지 완료')
  }

  const applyChoices = async () => {
    const resolutions = Object.fromEntries(
      fieldConflicts.map(conflict => [conflict.id, conflictChoices[conflict.id] || OPS_CONFLICT_KEEP_CURRENT])
    )
    await resolveOpsSyncConflicts(resolutions)
    setConflictChoices({})
    onToast?.('충돌 처리 완료')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
        {SESSION_VERSIONS.map((v, i) => {
          const active = displayVersionId === v.id
          const disabled = isVersionDisabled(v.id)
          const inactive = !active && !disabled
          const tone = VERSION_TONES[v.id] || VERSION_TONES[VERSION_DRAFT]
          return (
            <button
              key={v.id}
              data-coach={v.id === VERSION_DRAFT ? 'version-draft' : v.id === VERSION_SALES ? 'version-sales' : 'version-ops'}
              onClick={() => coachPreviewVersion ? null : handleSelect(v.id)}
              disabled={disabled}
              title={getVersionTitle(v.id)}
              style={{
                ...btnBase,
                borderLeftWidth: i === 0 ? 1 : 0,
                borderColor: tone.border,
                background: active ? tone.activeBg : tone.bg,
                color: active ? tone.activeColor : disabled ? 'var(--text3)' : tone.color,
                fontWeight: active ? 800 : 700,
                opacity: disabled ? 0.32 : inactive ? 0.52 : 1,
                filter: inactive ? 'saturate(.65)' : 'none',
                boxShadow: active ? `inset 0 0 0 1px ${tone.activeBg}, 0 0 0 1px ${tone.activeBg}40` : 'none',
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          data-coach="version-action"
          onClick={coachPreviewVersion ? undefined : handleVersionAction}
          disabled={!!coachPreviewVersion || isPublishingSales || isSyncingOps}
          style={{
            background: ACTION_TONE.bg,
            border: `1px solid ${ACTION_TONE.border}`,
            borderRadius: 6,
            color: ACTION_TONE.color,
            cursor: coachPreviewVersion || isPublishingSales || isSyncingOps ? 'default' : 'pointer',
            fontSize: 11,
            fontWeight: 900,
            height: 26,
            padding: '0 12px',
            whiteSpace: 'nowrap',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.45)',
          }}
        >
          {getActionLabel()}
        </button>
        <div
          title={`마지막 갱신: ${actionTimeText} / ${actionUserText}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 26,
            color: 'var(--text3)',
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {actionTimeText} · {actionUserText}
        </div>
      </div>
      {!!opsSyncConflicts?.length && (
        <OpsConflictModal
          fieldConflicts={fieldConflicts}
          ambiguousConflicts={ambiguousConflicts}
          choices={conflictChoices}
          setChoices={setConflictChoices}
          onKeepAll={() => chooseAll(OPS_CONFLICT_KEEP_CURRENT)}
          onUseSourceAll={() => chooseAll(OPS_CONFLICT_USE_SOURCE)}
          onApply={applyChoices}
        />
      )}
    </div>
  )
}

function OpsConflictModal({ fieldConflicts, ambiguousConflicts, choices, setChoices, onKeepAll, onUseSourceAll, onApply }) {
  return (
    <div style={modalBackdrop}>
      <div style={modalPanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900 }}>편성운영 갱신 충돌</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>
            입력값 {fieldConflicts.length}건 · 시간 이동 후보 {ambiguousConflicts.length}건
          </div>
        </div>
        <div style={conflictListStyle}>
          {fieldConflicts.map(conflict => {
            const choice = choices[conflict.id] || OPS_CONFLICT_KEEP_CURRENT
            return (
              <div key={conflict.id} style={conflictRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conflict.dateKey} {conflict.timeText} · {conflict.pgmCode || '-'} · {conflict.pgmCodeName || '-'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    {getConflictFieldLabel(conflict)}: 현재 "{formatConflictValue(conflict.currentValue)}" / 신규 "{formatConflictValue(conflict.sourceValue)}"
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setChoices(s => ({ ...s, [conflict.id]: OPS_CONFLICT_KEEP_CURRENT }))} style={choiceButtonStyle(choice === OPS_CONFLICT_KEEP_CURRENT)}>현재</button>
                  <button onClick={() => setChoices(s => ({ ...s, [conflict.id]: OPS_CONFLICT_USE_SOURCE }))} style={choiceButtonStyle(choice === OPS_CONFLICT_USE_SOURCE)}>신규</button>
                </div>
              </div>
            )
          })}
          {ambiguousConflicts.map(conflict => (
            <div key={conflict.id} style={conflictRowStyle}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900 }}>
                  시간 이동 후보 중복 · {conflict.dateKey} {conflict.timeText} · {conflict.pgmCode || '-'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  후보 {conflict.candidates?.length || 0}개라 자동 이전하지 않았습니다.
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onKeepAll} style={modalButtonStyle}>모두 현재값 유지</button>
          <button onClick={onUseSourceAll} style={modalButtonStyle}>모두 신규값 적용</button>
          <button onClick={onApply} style={{ ...modalButtonStyle, background: '#111827', color: '#fff', borderColor: '#111827' }}>선택 적용</button>
        </div>
      </div>
    </div>
  )
}

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  zIndex: 5000,
  background: 'rgba(15,23,42,.28)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

const modalPanel = {
  width: 'min(860px, 96vw)',
  maxHeight: '82vh',
  background: '#fff',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 22px 60px rgba(15,23,42,.24)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const conflictListStyle = {
  overflow: 'auto',
  maxHeight: '58vh',
  border: '1px solid var(--border)',
  borderRadius: 6,
}

const conflictRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
}

const modalButtonStyle = {
  border: '1px solid var(--border)',
  background: '#fff',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
}

const choiceButtonStyle = active => ({
  ...modalButtonStyle,
  padding: '5px 8px',
  background: active ? '#eff6ff' : '#fff',
  borderColor: active ? '#60a5fa' : 'var(--border)',
  color: active ? '#1d4ed8' : 'var(--text)',
})

function getConflictFieldLabel(conflict) {
  const labels = {
    requestNote: '기타요청',
    scheduleComment: '편성C',
    annotation: '첨삭',
    memoCode: '메모코드',
    memoCodeCode: '메모코드 코드',
    expectedSalesPerWeightedMin: '수기 취급/분',
    expectedProfitPerWeightedMin: '수기 한익/분',
  }
  return labels[conflict.field] || conflict.field
}

function formatConflictValue(value) {
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}
