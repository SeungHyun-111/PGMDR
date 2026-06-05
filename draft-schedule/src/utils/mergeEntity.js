// 엔티티 속성 필드 목록 — uniqueKey에 귀속되는 모든 가변 속성
export const ENTITY_FIELDS = [
  'pgmCodeName',
  'mdTeam', 'orgName',
  'mdCategory',
  'dealType', 'dealTypeConverted', 'dealTypeChar',
  'memoCode',
  'memoCodeCode',
  'memoCode2',
  'memoCode2Code',
  'requestNote',
  'scheduleComment',
  'annotation',
  'newProductType',
  'perfKey',
]

// 블록/아이템에서 엔티티 필드만 추출
export function extractEntityFields(src) {
  const out = {}
  ENTITY_FIELDS.forEach(f => { if (src[f] !== undefined) out[f] = src[f] })
  return out
}

// entityProps[uniqueKey]를 base 위에 머지 — entityProps 값이 항상 우선
export function resolveEntity(base, entityProps) {
  if (!base?.uniqueKey || !entityProps) return base
  const ep = entityProps[base.uniqueKey]
  return ep ? { ...base, ...ep } : base
}

// 블록/아이템 배열 전체에 resolveEntity 적용
export function applyEntityProps(items, entityProps) {
  if (!entityProps || !items) return items
  if (Array.isArray(items)) return items.map(i => resolveEntity(i, entityProps))
  // object map (scheduleBlocks 형태)
  const out = {}
  Object.entries(items).forEach(([k, v]) => {
    out[k] = v ? resolveEntity(v, entityProps) : v
  })
  return out
}
