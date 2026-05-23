export function encodeKey(key) {
  return key.replace(/\[/g, '__LB__').replace(/\]/g, '__RB__')
}

export function decodeKey(key) {
  return key.replace(/__LB__/g, '[').replace(/__RB__/g, ']')
}

export function decodeMapKeys(obj) {
  if (!obj) return {}
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [decodeKey(k), v])
  )
}
