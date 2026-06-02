import useScheduleStore from '../../store/useScheduleStore'
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

export default function VersionSwitcher({ onToast }) {
  const {
    currentVersionId,
    versionMeta,
    setSessionVersion,
    publishSalesVersion,
    isPublishingSales,
  } = useScheduleStore()

  const salesPublishedAt = versionMeta?.[VERSION_SALES]?.publishedAt
  const opsPublishedAt = versionMeta?.[VERSION_OPS]?.publishedAt
  const actionMeta = currentVersionId === VERSION_DRAFT
    ? versionMeta?.[VERSION_SALES]
    : versionMeta?.[VERSION_OPS]

  const handleSelect = async (versionId) => {
    if (versionId === currentVersionId) return
    if (versionId === VERSION_SALES && !salesPublishedAt) {
      alert('영업팀 공유본이 아직 없습니다. 담당 작성에서 먼저 공유본을 생성하세요.')
      return
    }
    if (versionId === VERSION_OPS) {
      alert('편성운영 화면은 Google 웹앱 연동 후 사용할 예정입니다.')
      return
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
    onToast?.(salesPublishedAt ? '초안 확정 완료' : '초안 확정 완료')
  }

  const handleOpsPrepare = () => {
    alert('편성 확정 기능은 Google 웹앱 연동 후 연결합니다.')
  }

  const handleLoadCurrentSchedule = () => {
    alert('버전 갱신 기능은 Google 웹앱 편성운영 화면에서 연결할 예정입니다.')
  }

  const getActionLabel = () => {
    if (currentVersionId === VERSION_DRAFT) return isPublishingSales ? '확정 중...' : '초안 확정'
    if (currentVersionId === VERSION_SALES) return '편성 확정'
    if (currentVersionId === VERSION_OPS) return '버전 갱신'
    return '버전 갱신'
  }

  const handleVersionAction = () => {
    if (currentVersionId === VERSION_DRAFT) return handlePublish()
    if (currentVersionId === VERSION_SALES) return handleOpsPrepare()
    return handleLoadCurrentSchedule()
  }

  const isVersionDisabled = (versionId) => {
    if (versionId === VERSION_SALES) return !salesPublishedAt
    if (versionId === VERSION_OPS) return !opsPublishedAt
    return false
  }

  const getVersionTitle = (versionId) => {
    if (versionId === VERSION_SALES && !salesPublishedAt) return '공유본 없음'
    if (versionId === VERSION_OPS) return opsPublishedAt ? getVersionLabel(versionId) : 'Google 웹앱 연동 후 사용'
    return getVersionLabel(versionId)
  }

  const actionTimeText = formatMetaTime(actionMeta?.publishedAt || actionMeta?.updatedAt)
  const actionUserText = actionMeta?.publishedBy || actionMeta?.updatedBy || '-'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
        {SESSION_VERSIONS.map((v, i) => {
          const active = currentVersionId === v.id
          const disabled = isVersionDisabled(v.id)
          const tone = VERSION_TONES[v.id] || VERSION_TONES[VERSION_DRAFT]
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              disabled={disabled}
              title={getVersionTitle(v.id)}
              style={{
                ...btnBase,
                borderLeftWidth: i === 0 ? 1 : 0,
                borderColor: tone.border,
                background: active ? tone.activeBg : tone.bg,
                color: active ? tone.activeColor : disabled ? 'var(--text3)' : tone.color,
                fontWeight: active ? 800 : 700,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleVersionAction}
          disabled={isPublishingSales}
          style={{
            background: ACTION_TONE.bg,
            border: `1px solid ${ACTION_TONE.border}`,
            borderRadius: 6,
            color: ACTION_TONE.color,
            cursor: isPublishingSales ? 'default' : 'pointer',
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
    </div>
  )
}
