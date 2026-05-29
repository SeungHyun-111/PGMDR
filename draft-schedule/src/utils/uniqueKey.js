import { db, ref, push } from '../api/firebase'

export const UNIQUE_KEY_PREFIX = {
  SYSTEM: '0',
  PROPOSAL: '1',
  PRE_SCHEDULE: '2',
  COMPETITION: '3',
}

export function genKey(prefix) {
  return `${prefix}_${push(ref(db, 'entityKeys')).key}`
}
