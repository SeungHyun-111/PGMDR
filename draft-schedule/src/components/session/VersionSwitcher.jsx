import useScheduleStore from '../../store/useScheduleStore'
import { SESSION_VERSIONS, VERSION_DRAFT, VERSION_SALES, getVersionLabel } from '../../utils/sessionVersion'

const btnBase = {
  border: '1px solid var(--border)',
  padding: '4px 9px',
  fontSize: 11,
  cursor: 'pointer',
  height: 26,
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
  const currentLabel = getVersionLabel(currentVersionId)

  const handleSelect = async (versionId) => {
    if (versionId === currentVersionId) return
    if (versionId === VERSION_SALES && !salesPublishedAt) {
      alert('영업팀 공유본이 아직 없습니다. 담당 작성에서 먼저 공유본을 생성하세요.')
      return
    }
    await setSessionVersion(versionId)
  }

  const handlePublish = async () => {
    if (currentVersionId !== VERSION_DRAFT) {
      alert('영업팀 공유본 생성/갱신은 담당 작성 버전에서만 가능합니다.')
      return
    }
    const msg = salesPublishedAt
      ? '현재 담당 작성본으로 영업팀 공유본을 덮어쓸까요?'
      : '현재 담당 작성본으로 영업팀 공유본을 생성할까요?'
    if (!window.confirm(msg)) return
    await publishSalesVersion()
    onToast?.(salesPublishedAt ? '영업팀 공유본 갱신 완료' : '영업팀 공유본 생성 완료')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden' }}>
        {SESSION_VERSIONS.map((v, i) => {
          const active = currentVersionId === v.id
          const disabled = v.id === VERSION_SALES && !salesPublishedAt
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v.id)}
              disabled={disabled}
              title={disabled ? '공유본 없음' : getVersionLabel(v.id)}
              style={{
                ...btnBase,
                borderLeftWidth: i === 0 ? 1 : 0,
                background: active ? 'var(--accent)' : 'var(--bg3)',
                color: active ? '#fff' : disabled ? 'var(--text3)' : 'var(--text2)',
                fontWeight: active ? 700 : 500,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      <button
        onClick={handlePublish}
        disabled={isPublishingSales || currentVersionId !== VERSION_DRAFT}
        style={{
          background: currentVersionId === VERSION_DRAFT ? 'var(--bg3)' : 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: currentVersionId === VERSION_DRAFT ? 'var(--accent)' : 'var(--text3)',
          cursor: currentVersionId === VERSION_DRAFT ? 'pointer' : 'not-allowed',
          fontSize: 11,
          fontWeight: 700,
          height: 26,
          padding: '0 10px',
          whiteSpace: 'nowrap',
        }}
      >
        {isPublishingSales ? '공유 중...' : salesPublishedAt ? '공유본 갱신' : '공유본 생성'}
      </button>
      <div
        title={`현재버전 ${currentLabel}`}
        style={{
          height: 26,
          display: 'flex',
          alignItems: 'center',
          padding: '0 9px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg2)',
          color: 'var(--text2)',
          fontSize: 11,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        현재버전 {currentLabel}
      </div>
    </div>
  )
}
