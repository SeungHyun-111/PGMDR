import assert from 'node:assert/strict'
import { buildOpsOverlayResult, makeOpsExactKey } from '../src/domain/ops/opsOverlay.js'

const block = (uniqueKey, timeText = '12:00', extra = {}) => ({
  uniqueKey,
  dateKey: '2026-09-14',
  timeText,
  dealTypeConverted: '[정]',
  dealType: '[정]',
  pgmCode: 'PGM001',
  pgmCodeName: '테스트상품',
  requestNote: '',
  scheduleComment: '',
  annotation: '',
  memoCode: '',
  memoCodeCode: '',
  ...extra,
})

const version = ({ blocks = {}, entityProps = {}, manualInputs = {}, opsOverlay = {} } = {}) => ({
  scheduleBlocks: blocks,
  entityProps,
  manualInputs,
  opsOverlay,
})

const source = (blocks) => {
  const sourceBlocks = {}
  const sourceEntityProps = {}
  Object.entries(blocks).forEach(([key, value]) => {
    sourceBlocks[key] = value
    sourceEntityProps[value.uniqueKey] = {
      requestNote: value.requestNote || '',
      scheduleComment: value.scheduleComment || '',
      annotation: value.annotation || '',
      memoCode: value.memoCode || '',
      memoCodeCode: value.memoCodeCode || '',
    }
  })
  return { sourceBlocks, sourceEntityProps }
}

function run(name, fn) {
  fn()
  console.log(`ok ${name}`)
}

run('A. Sales와 OPS Source가 완전 동일', () => {
  const s = source({ a: block('src1') })
  const result = buildOpsOverlayResult({
    mode: 'initial',
    ...s,
    salesVersion: version({ blocks: { old: block('sales1') } }),
  })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.scheduleBlocks.a.uniqueKey, 'sales1')
})

run('B. Sales에 사용자 입력 있고 OPS Source 신규 생성', () => {
  const s = source({ a: block('src1') })
  const result = buildOpsOverlayResult({
    mode: 'initial',
    ...s,
    salesVersion: version({
      blocks: { old: block('sales1') },
      entityProps: { sales1: { requestNote: '기타', scheduleComment: '편성C', annotation: '첨삭', memoCode: 'M1' } },
      manualInputs: { sales1: { expectedSalesPerWeightedMin: 100 } },
    }),
  })
  assert.equal(result.entityProps.sales1.requestNote, '기타')
  assert.equal(result.entityProps.sales1.scheduleComment, '편성C')
  assert.equal(result.entityProps.sales1.annotation, '첨삭')
  assert.equal(result.entityProps.sales1.memoCode, 'M1')
  assert.equal(result.manualInputs.sales1.expectedSalesPerWeightedMin, 100)
})

run('C. OPS에서 사용자 수정 후 Source 변화 없음', () => {
  const s = source({ a: block('src2', '12:00', { requestNote: '원본' }) })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({
      blocks: { old: block('ops1', '12:00', { requestNote: '원본' }) },
      entityProps: { ops1: { requestNote: '사용자' } },
      opsOverlay: { dirtyByUniqueKey: { ops1: { requestNote: true } } },
    }),
    dirtyByUniqueKey: { ops1: { requestNote: true } },
  })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.entityProps.ops1.requestNote, '사용자')
})

run('D. OPS에서 사용자 수정 없음 + Source 값 변경', () => {
  const s = source({ a: block('src2', '12:00', { requestNote: '신규' }) })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({
      blocks: { old: block('ops1', '12:00', { requestNote: '기존' }) },
    }),
  })
  assert.equal(result.entityProps.ops1.requestNote, '신규')
})

run('E. OPS에서 사용자 수정 있음 + Source도 다른 값으로 변경', () => {
  const s = source({ a: block('src2', '12:00', { requestNote: '신규' }) })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({
      blocks: { old: block('ops1', '12:00', { requestNote: '기존' }) },
      entityProps: { ops1: { requestNote: '사용자' } },
    }),
    dirtyByUniqueKey: { ops1: { requestNote: true } },
  })
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.entityProps.ops1.requestNote, '사용자')
})

run('F. 방송 시간이 12시에서 13시로 이동', () => {
  const s = source({ a: block('src2', '13:00') })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({ blocks: { old: block('ops1', '12:00') } }),
  })
  assert.equal(result.conflicts.length, 0)
  assert.equal(result.scheduleBlocks.a.uniqueKey, 'ops1')
})

run('G. 동일 조건 후보가 2개 생김', () => {
  const s = source({ a: block('src2', '13:00') })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({
      blocks: {
        old1: block('ops1', '12:00'),
        old2: block('ops2', '14:00'),
      },
    }),
  })
  assert.equal(result.conflicts.some(conflict => conflict.type === 'ambiguous'), true)
})

run('H. 기존 방송 삭제', () => {
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    sourceBlocks: {},
    sourceEntityProps: {},
    currentOpsVersion: version({
      blocks: { old: block('ops1') },
      entityProps: { ops1: { requestNote: '보존' } },
    }),
  })
  assert.equal(Object.keys(result.scheduleBlocks).length, 0)
  assert.equal(Object.values(result.opsOverlay.orphans)[0].entity.requestNote, '보존')
})

run('I. 삭제됐던 방송이 같은 주차에서 다시 등장', () => {
  const orphanKey = makeOpsExactKey(block('ops1'))
  const s = source({ a: block('src2') })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version(),
    orphans: {
      [orphanKey]: {
        uniqueKey: 'ops1',
        entity: { requestNote: '복구' },
        manual: { expectedProfitPerWeightedMin: 7 },
        dirty: { requestNote: true, manual: { expectedProfitPerWeightedMin: true } },
      },
    },
  })
  assert.equal(result.scheduleBlocks.a.uniqueKey, 'ops1')
  assert.equal(result.entityProps.ops1.requestNote, '복구')
  assert.equal(result.manualInputs.ops1.expectedProfitPerWeightedMin, 7)
})

run('J. 채널분리만 다른 경우', () => {
  const s = source({
    ca: block('srcCA', '12:00', { channel: 'CA' }),
    ip: block('srcIP', '12:00', { channel: 'IP' }),
  })
  const result = buildOpsOverlayResult({
    mode: 'refresh',
    ...s,
    currentOpsVersion: version({
      blocks: {
        caOld: block('opsCA', '12:00', { channel: 'CA' }),
        ipOld: block('opsIP', '12:00', { channel: 'IP' }),
      },
    }),
  })
  assert.equal(result.scheduleBlocks.ca.uniqueKey, 'opsCA')
  assert.equal(result.scheduleBlocks.ip.uniqueKey, 'opsIP')
})

run('K. 수기실적 취급/분만 입력', () => {
  const s = source({ a: block('src1') })
  const result = buildOpsOverlayResult({
    mode: 'initial',
    ...s,
    salesVersion: version({
      blocks: { old: block('sales1') },
      manualInputs: { sales1: { expectedSalesPerWeightedMin: 123 } },
    }),
  })
  assert.deepEqual(result.manualInputs.sales1, { expectedSalesPerWeightedMin: 123 })
})

run('L. 수기실적 한익/분만 입력', () => {
  const s = source({ a: block('src1') })
  const result = buildOpsOverlayResult({
    mode: 'initial',
    ...s,
    salesVersion: version({
      blocks: { old: block('sales1') },
      manualInputs: { sales1: { expectedProfitPerWeightedMin: 456 } },
    }),
  })
  assert.deepEqual(result.manualInputs.sales1, { expectedProfitPerWeightedMin: 456 })
})
