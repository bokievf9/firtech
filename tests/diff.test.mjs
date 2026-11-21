import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diffStats, sideBySide, tokenize, wordDiff } from '../src/lib/diff.ts'

const join = (ops, types) => ops.filter((o) => types.includes(o.type)).map((o) => o.text).join('')

test('tokenize keeps whitespace so the tokens join back into the text', () => {
  const s = 'Здравствуйте,  Нигина!\nСрок: 5 дней.'
  assert.equal(tokenize(s).join(''), s)
  assert.deepEqual(tokenize(''), [])
})

test('wordDiff: equal texts and empty sides', () => {
  assert.deepEqual(wordDiff('', ''), [])
  assert.deepEqual(wordDiff('a b', 'a b'), [{ type: 'eq', text: 'a b' }])
  assert.deepEqual(wordDiff('', 'a b'), [{ type: 'add', text: 'a b' }])
  assert.deepEqual(wordDiff('a b', ''), [{ type: 'del', text: 'a b' }])
})

test('wordDiff: a replaced word is one deletion and one addition, the rest is shared', () => {
  const ops = wordDiff('Срок 5 дней, цена 300', 'Срок 7 дней, цена 300')
  assert.equal(join(ops, ['eq', 'del']), 'Срок 5 дней, цена 300')
  assert.equal(join(ops, ['eq', 'add']), 'Срок 7 дней, цена 300')
  assert.deepEqual(ops.filter((o) => o.type === 'del').map((o) => o.text), ['5'])
  assert.deepEqual(ops.filter((o) => o.type === 'add').map((o) => o.text), ['7'])
})

test('wordDiff: insertion in the middle and removal at the start', () => {
  const ins = wordDiff('один три', 'один два три')
  assert.equal(join(ins, ['eq', 'add']), 'один два три')
  assert.equal(join(ins, ['eq', 'del']), 'один три')
  assert.equal(diffStats(ins).added, 1)
  const del = wordDiff('Здравствуйте! Привет мир', 'Привет мир')
  assert.equal(diffStats(del).removed, 1)
  assert.equal(join(del, ['eq', 'add']), 'Привет мир')
})

test('wordDiff: moved words are reported as a deletion plus an addition, both sides reconstruct', () => {
  const a = 'a b c d e f'
  const b = 'a c b d f e g'
  const ops = wordDiff(a, b)
  assert.equal(join(ops, ['eq', 'del']), a)
  assert.equal(join(ops, ['eq', 'add']), b)
})

test('sideBySide splits the same ops into the old and the new column', () => {
  const ops = wordDiff('цена 300 долларов', 'цена 450 долларов США')
  const { left, right } = sideBySide(ops)
  assert.equal(left.map((o) => o.text).join(''), 'цена 300 долларов')
  assert.equal(right.map((o) => o.text).join(''), 'цена 450 долларов США')
  assert.ok(left.every((o) => o.type !== 'add'))
  assert.ok(right.every((o) => o.type !== 'del'))
})

test('diffStats counts words, not whitespace', () => {
  assert.deepEqual(diffStats(wordDiff('a b', 'a  b')), { added: 0, removed: 0, changed: true })
  assert.deepEqual(diffStats(wordDiff('a b', 'a b')), { added: 0, removed: 0, changed: false })
  assert.deepEqual(diffStats(wordDiff('a b c', 'a x y c')), { added: 2, removed: 1, changed: true })
})

test('a very long text does not freeze: it falls back to a coarse diff that still reconstructs both', () => {
  const a = Array.from({ length: 6000 }, (_, i) => `w${i}`).join(' ')
  const b = Array.from({ length: 6000 }, (_, i) => `v${i}`).join(' ')
  const t0 = Date.now()
  const ops = wordDiff(a, b)
  assert.ok(Date.now() - t0 < 2000)
  assert.equal(join(ops, ['eq', 'del']), a)
  assert.equal(join(ops, ['eq', 'add']), b)
})
