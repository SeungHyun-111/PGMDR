// 채널 목록 - 직접 관리
export const CHANNELS = ['CA', 'IP', 'ALL']

export function getChannelStyle(channel) {
  switch (channel) {
    case 'CA':  return { bg: 'var(--ca)',  color: 'var(--ca-t)',  border: 'rgba(126,179,245,.35)' }
    case 'IP':  return { bg: 'var(--ip)',  color: 'var(--ip-t)',  border: 'rgba(196,126,245,.35)' }
    case 'ALL': return { bg: 'var(--all)', color: 'var(--all-t)', border: 'rgba(127,212,127,.35)' }
    default:    return { bg: 'var(--bg4)', color: 'var(--text2)', border: 'var(--border)' }
  }
}