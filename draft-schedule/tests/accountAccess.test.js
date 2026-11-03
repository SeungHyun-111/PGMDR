import test from 'node:test'
import assert from 'node:assert/strict'
import { accountName, APPROVED_ACCOUNTS } from '../src/utils/accountAccess.js'

test('approved UIDs use the matching email name', () => {
  assert.equal(Object.keys(APPROVED_ACCOUNTS).length, 6)
  for (const [uid, name] of Object.entries(APPROVED_ACCOUNTS)) {
    assert.equal(accountName({ uid, email: `${name}@스토아.com`, displayName: '다른 이름' }), name)
    assert.equal(accountName({ uid, email: '다른이름@스토아.com' }), '')
    assert.equal(accountName({ uid }), '')
  }
})

test('signed-out and unapproved identities cannot enter', () => {
  assert.equal(accountName(null), '')
  assert.equal(accountName({ uid: 'unknown', email: '강은비@스토아.com' }), '')
  assert.equal(accountName({ uid: 'toString', email: '강은비@스토아.com' }), '')
})
