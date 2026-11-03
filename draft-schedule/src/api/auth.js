import { getAuth, browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { app } from './firebase'
import { accountName } from '../utils/accountAccess'

export const auth = getAuth(app)

export async function login(email, password) {
  await setPersistence(auth, browserSessionPersistence)
  const result = await signInWithEmailAndPassword(auth, email.trim(), password)
  if (!accountName(result.user)) {
    await signOut(auth)
    throw new Error('이 사이트의 접속 권한이 없는 계정입니다.')
  }
}

export async function logout() {
  await signOut(auth)
  // Clear the mounted application and its cached session before another login.
  window.location.reload()
}
