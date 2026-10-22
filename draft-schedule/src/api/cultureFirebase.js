import { getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const appName = 'pgmdr-culture'
const cultureApp = getApps().find(app => app.name === appName) || initializeApp({
  apiKey: 'AIzaSyCZ1p3w3j7hwiCS82TyhatIomDOv1JgiGc',
  authDomain: 'broadcast-schedule-6c97d.firebaseapp.com',
  projectId: 'broadcast-schedule-6c97d',
  appId: '1:211383823127:web:831529f110a3fbb35ee552',
}, appName)

// Shared temporary account explicitly designated for PGMDR by its owner.
const account = { email: '스토아@편성.net', password: '1234567' }
const auth = getAuth(cultureApp)
let loginPromise

export function ensureCultureAuth() {
  if (loginPromise) return loginPromise
  loginPromise = (async () => {
    await setPersistence(auth, browserLocalPersistence)
    await auth.authStateReady()
    if (auth.currentUser?.email === account.email) return auth.currentUser
    const { user } = await signInWithEmailAndPassword(auth, account.email, account.password)
    return user
  })().catch(error => {
    throw new Error(`편성코드 DB 자동 로그인 실패 (${error.code || '연결 오류'}).`)
  }).finally(() => { loginPromise = undefined })
  return loginPromise
}

export function getCultureDatabase() {
  return getDatabase(cultureApp, (import.meta.env?.VITE_CULTURE_DATABASE_URL || 'https://broadcast-schedule-6c97d-default-rtdb.asia-southeast1.firebasedatabase.app').replace(/\/$/, ''))
}
