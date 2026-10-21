import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, get, update, onValue, off, onDisconnect, push, query, orderByKey, limitToLast, startAt, endAt, runTransaction } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBUtgorDnost1ktHcag9APKEx9KzScEBFA",
  authDomain: "pgmdr-87328.firebaseapp.com",
  databaseURL: "https://pgmdr-87328-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pgmdr-87328",
  storageBucket: "pgmdr-87328.firebasestorage.app",
  messagingSenderId: "776744459707",
  appId: "1:776744459707:web:5ffaa6114791bda394b89e"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

export { db, ref, set, get, update, onValue, off, onDisconnect, push, query, orderByKey, limitToLast, startAt, endAt, runTransaction }
