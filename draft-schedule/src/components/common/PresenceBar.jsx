// src/components/common/PresenceBar.jsx
import { useState } from 'react'
import useScheduleStore from '../../store/useScheduleStore'
import { getVersionLabel } from '../../utils/sessionVersion'
import { usePresenceUsers } from '../../hooks/usePresence'

const COLORS = ['#4a6cf7','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']

const TAB_LABELS = {
  draft: '초안 편성',
  forecast: '성과 예측',
  ratio: '편성 비중',
  status: '편성 현황',
  settings: '설정',
  help: '도움말',
}

function getColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getLocationText(user) {
  const session = user.weekKey || [user.startDate, user.poolType].filter(Boolean).join('_') || '-'
  const tab = TAB_LABELS[user.tabId] || user.tabId || '-'
  const version = user.versionId ? getVersionLabel(user.versionId) : '-'
  return `${tab} / ${session} / ${version}`
}

export default function PresenceBar({ forceOpen = false }) {
  const { userName } = useScheduleStore()
  const users = usePresenceUsers()
  const [open, setOpen] = useState(false)

  if (users.length === 0) return null

  return (
    <div
      data-coach="presence"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      {users.map((u, i) => (
        <div
          key={u.uid || `${u.userName}_${i}`}
          title={`${u.userName} - ${getLocationText(u)}`}
          style={{
            minWidth: 26,
            maxWidth: 42,
            height: 24,
            padding: '0 6px',
            borderRadius: 999,
            background: getColor(u.userName),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: '#fff',
            border: u.userName === userName ? '2px solid var(--accent)' : '2px solid var(--bg2)',
            cursor: 'default',
            flexShrink: 0,
            boxSizing: 'border-box',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
          }}
        >
          {(u.userName || '?').slice(0, 3)}
        </div>
      ))}
      <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 2 }}>
        {users.length}명 접속 중
      </span>

      {(open || forceOpen) && (
        <div style={{
          position: 'absolute',
          top: 30,
          right: 0,
          width: 260,
          maxWidth: 'calc(100vw - 24px)',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 10px 28px rgba(0,0,0,.16)',
          padding: 8,
          zIndex: 500,
        }}>
          {users.map((u, i) => (
            <div key={u.uid || `row_${u.userName}_${i}`} style={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr)',
              gap: 8,
              alignItems: 'center',
              padding: '7px 6px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: getColor(u.userName),
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {(u.userName || '?').slice(0, 2)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.userName || '익명'}
                </div>
                <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getLocationText(u)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
