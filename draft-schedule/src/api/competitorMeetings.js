import { getApps, initializeApp } from 'firebase/app'
import { getDatabase, onValue, ref, update, serverTimestamp } from 'firebase/database'

const databaseURL = 'https://schedule-7ec7a-default-rtdb.asia-southeast1.firebasedatabase.app'
const appName = 'pgmdr-competitor'
const app = getApps().find(app => app.name === appName) || initializeApp({ projectId: 'schedule-7ec7a', databaseURL }, appName)
const db = getDatabase(app)
export const organizationKey = name => Array.from(name, char => char.codePointAt(0).toString(16)).join('-')
const weekPath = week => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('유효한 주차를 선택해주세요.')
  return `competitorInfo/meetingNotes/${week}/organizations`
}

export function subscribeCompetitorMeetings(week, onData, onError) {
  return onValue(ref(db, weekPath(week)), snapshot => onData(snapshot.val() || {}), onError)
}

// Queue writes per organization so rapid edits and tab changes preserve the final value.
const writes = new Map()
export function saveCompetitorMeeting(week, organization, company, content, userName) {
  if (!['SSG', 'K'].includes(company)) throw new Error('유효한 채널을 선택해주세요.')
  const parent = `${weekPath(week)}/${organizationKey(organization)}`
  const path = `${parent}/channels/${company}`
  const write = (writes.get(path) || Promise.resolve()).catch(() => {}).then(() => update(ref(db, parent), {
    organization,
    [`channels/${company}`]: { content, updatedBy: userName || '', updatedAt: serverTimestamp() },
  }))
  writes.set(path, write)
  const clean = () => { if (writes.get(path) === write) writes.delete(path) }
  write.then(clean, clean)
  return write
}
