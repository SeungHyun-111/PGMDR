import { db, ref, onValue } from '../../api/firebase'
import { decodeMapKeys } from '../../utils/firebaseKey'

const _subs = {}

export function subscribePath(path, handler) {
  if (_subs[path]) _subs[path]()
  const unsub = onValue(ref(db, path), handler)
  _subs[path] = unsub
}

export function unsubscribeAll() {
  Object.values(_subs).forEach(unsub => unsub())
  Object.keys(_subs).forEach(k => delete _subs[k])
}

export function subscribeRealtimePaths(weekKey, setState) {
  unsubscribeAll()
  const paths = {
    [`sessions/${weekKey}/scheduleBlocks`]:   snap => setState({ scheduleBlocks:   snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/splitSlots`]:       snap => setState({ splitSlots:       snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/customSlots`]:      snap => setState({ customSlots:      snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/starred`]:          snap => setState({ starred:          snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/scheduledItemIds`]: snap => setState({ scheduledItemIds: snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/manualInputs`]:     snap => setState({ manualInputs:     snap.exists() ? decodeMapKeys(snap.val()) : {} }),
  }
  Object.entries(paths).forEach(([path, handler]) => subscribePath(path, handler))
}