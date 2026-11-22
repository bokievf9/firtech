import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cn } from '../src/lib/cn.ts'

test('v4 size keeps the colour', () => {
  assert.equal(cn('text-callout text-muted'), 'text-callout text-muted')
  assert.equal(cn('text-muted text-title-2'), 'text-muted text-title-2')
})
test('size vs size keeps the last', () => {
  assert.equal(cn('text-sm text-callout'), 'text-callout')
  assert.equal(cn('text-title text-lead'), 'text-lead')
})
test('colour vs colour merges', () => {
  assert.equal(cn('text-fg text-muted'), 'text-muted')
})
