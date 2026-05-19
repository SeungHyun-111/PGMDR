import { useState } from 'react'

function getDealTypeChar(block) {
  if (block.dealTypeChar) return block.dealTypeChar
  if (!block.dealType) return ''
  if (block.dealType.includes('모바일광고')) return '광'
  return block.dealType.charAt(0)
}

function getTeamShort(orgName) {
  if (!orgName) return ''
  return orgName.length > 2 ? orgName.slice(0, 2) : orgName
}

export default function ScheduleBlock({ block, height }) {
  const [hover, setHover] = useState(false)

  const isIP = block.channel === 'IP'
  const isAll = block.channel === 'ALL'
  const bgColor = isIP ? 'var(--ip2)' : isAll ? 'var(--all2)' : 'var(--ca2)'
  const borderColor = isIP ? 'rgba(196,126,245,.35)' : isAll ? 'rgba(127,212,127,.35)' : 'rgba(126,179,245,.35)'

  const teamShort = getTeamShort(block.orgName || block.mdTeam)
  const dealChar = getDealTypeChar(block)
  const pgmName = block.pgmCodeName || ''
  const weightedMin = block.weightedMin || 0

  return (
    <div
      style={{ position: 'absolute', inset: '1px' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 블록 본체 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 3, overflow: 'hidden', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        padding: '0 4px', gap: 3,
        opacity: block.isPreSchedule ? 0.8 : 1
      }}>
        {/* 팀명 배지 */}
        {teamShort && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: '#fff',
            background: 'rgba(0,0,0,.3)', padding: '0 4px', height: 14,
            borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0,
            display: 'flex', alignItems: 'center'
          }}>
            {teamShort}
          </span>
        )}

        {/* 거래형태 배지 */}
        {dealChar && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: '#fff',
            background: 'rgba(0,0,0,.3)', padding: '0 4px', height: 14,
            borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0,
            display: 'flex', alignItems: 'center'
          }}>
            {dealChar}
          </span>
        )}

        {/* 편성코드명 - 남은 공간, 짤리면 짤리는대로 */}
        <span style={{
          fontSize: 9, fontWeight: 600, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, minWidth: 0
        }}>
          {pgmName}
        </span>

        {/* 가중분 - 작게 */}
        {weightedMin > 0 && (
          <span style={{
            fontSize: 8, color: 'rgba(255,255,255,.5)',
            whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {weightedMin}
          </span>
        )}
      </div>

      {/* 툴팁 */}
      {hover && (
        <div style={{
          position: 'absolute', left: '105%', top: 0, zIndex: 999,
          background: 'var(--bg3)', border: '1px solid var(--border2)',
          borderRadius: 6, padding: '8px 10px', minWidth: 200, maxWidth: 280,
          boxShadow: '0 4px 16px rgba(0,0,0,.5)', pointerEvents: 'none'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {pgmName}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              ['팀', block.orgName || block.mdTeam || '-'],
              ['채널', block.channel || '-'],
              ['거래형태', block.dealType || block.dealTypeChar || '-'],
              ['방송일시', `${block.dateKey} ${block.timeText}`],
              ['방송시간', `${block.durationMin}분`],
              ['가중분', weightedMin],
              ['선편성', block.isPreSchedule ? '✓' : '-'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                <span style={{ color: 'var(--text3)', minWidth: 50 }}>{label}</span>
                <span style={{ color: 'var(--text)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}