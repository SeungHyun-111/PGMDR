import { onValue, ref, update, serverTimestamp } from 'firebase/database'
import { competitorDb, organizationKey } from './competitorMeetings'

export const WEEKLY_WORK_OWNERS = ['최희우', '이상학', '강은비', '이승현', '안선민']
const weekPath = week => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('주차를 선택해주세요.')
  return `competitorInfo/weeklyWork/${week}/owners`
}
export function subscribeWeeklyWork(week, onData, onError) {
  return onValue(ref(competitorDb, weekPath(week)), snapshot => onData(snapshot.val() || {}), onError)
}
export function saveWeeklyWork(week, owner, field, content, userName) {
  if (!WEEKLY_WORK_OWNERS.includes(owner) || !['previous', 'current', 'remarks'].includes(field)) throw new Error('잘못된 주간업무 항목입니다.')
  return update(ref(competitorDb, `${weekPath(week)}/${organizationKey(owner)}`), {
    owner, [field]: { content, updatedBy: userName || '', updatedAt: serverTimestamp() },
  })
}
