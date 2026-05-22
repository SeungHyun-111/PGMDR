import { db, ref, onValue, off } from '../../api/firebase'

const _subs = {}

export function subscribePath(path, handler) {
  if (_subs[path]) off(ref(db, path))
  const r = ref(db, path)
  onValue(r, handler)
  _subs[path] = r
}

export function unsubscribeAll() {
  Object.values(_subs).forEach(r => off(r))
  Object.keys(_subs).forEach(k => delete _subs[k])
}

function decodeMapKeys(obj) {
  if (!obj) return {}
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.replace(/__LB__/g, '[').replace(/__RB__/g, ']'), v])
  )
}

export function subscribeRealtimePaths(weekKey, setState) {
  unsubscribeAll()
  const paths = {
    [`sessions/${weekKey}/scheduleBlocks`]:   snap => setState({ scheduleBlocks:   snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/splitSlots`]:       snap => setState({ splitSlots:       snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/starred`]:          snap => setState({ starred:          snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/scheduledItemIds`]: snap => setState({ scheduledItemIds: snap.exists() ? snap.val() : {} }),
    [`sessions/${weekKey}/manualInputs`]:     snap => setState({ manualInputs:     snap.exists() ? decodeMapKeys(snap.val()) : {} }),
  }
  Object.entries(paths).forEach(([path, handler]) => subscribePath(path, handler))
}