/**
 * Firebase sessions 정리 스크립트
 * 실행: node scripts/cleanup-sessions.mjs
 *
 * activeSessions에 등록된 세션은 보호되고,
 * 나머지 sessions/{weekKey} 는 모두 삭제됩니다.
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set } from 'firebase/database'

const firebaseConfig = {
  apiKey:            'AIzaSyBUtgorDnost1ktHcag9APKEx9KzScEBFA',
  authDomain:        'pgmdr-87328.firebaseapp.com',
  databaseURL:       'https://pgmdr-87328-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'pgmdr-87328',
  storageBucket:     'pgmdr-87328.firebasestorage.app',
  messagingSenderId: '776744459707',
  appId:             '1:776744459707:web:5ffaa6114791bda394b89e',
}

const app = initializeApp(firebaseConfig)
const db  = getDatabase(app)

async function main() {
  console.log('Firebase 연결 중...')

  const [sessionsSnap, activeSnap] = await Promise.all([
    get(ref(db, 'sessions')),
    get(ref(db, 'activeSessions')),
  ])

  if (!sessionsSnap.exists()) {
    console.log('sessions 데이터 없음. 종료.')
    process.exit(0)
  }

  const allKeys    = Object.keys(sessionsSnap.val())
  const activeKeys = activeSnap.exists() ? Object.keys(activeSnap.val()) : []

  console.log(`\n전체 세션 ${allKeys.length}개 전부 삭제합니다:`, allKeys)
  console.log('\n삭제 중...')

  await Promise.all([
    set(ref(db, 'sessions'),       null),
    set(ref(db, 'activeSessions'), null),
    set(ref(db, 'activeSession'),  null),
  ])

  console.log('완료: sessions / activeSessions / activeSession 전체 삭제됨.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
