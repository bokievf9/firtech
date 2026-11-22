// Fira on the inner pages (owner 2026-11-22): the face of the chat launcher with one line per page, and
// the one face constant shared with the home film.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { companionKind, markSeen, seenList } from '../src/lib/film.ts'
import { firaFace } from '../src/lib/fira/face.ts'

const read = (p) => readFileSync(p, 'utf8')

test('companion: one face constant drives the film, the launcher and the chat avatar', () => {
  assert.ok(['a', 'b', 'c', 'd'].includes(firaFace), 'the round-eight turtle')
  for (const f of ['src/components/film/film-overlay.tsx', 'src/components/fira/fira-flat.tsx', 'src/components/fira/fira-guide.tsx']) {
    const code = read(f)
    assert.match(code, /firaFace/, f)
    assert.doesNotMatch(code, /variant=["'][a-m]["']/, `${f} types no letter of its own`)
  }
})

test('companion: one line per kind of page, none on the home page, once per page and session', () => {
  assert.equal(companionKind('/ru'), null)
  assert.equal(companionKind('/en/'), null)
  assert.equal(companionKind('/ru/products/admin'), 'product')
  assert.equal(companionKind('/ru/products/personal'), 'personal')
  assert.equal(companionKind('/en/products/personal/'), 'personal')
  assert.equal(companionKind('/ru/services/sites'), 'service')
  assert.equal(companionKind('/en/solutions/salon'), 'solution')
  assert.equal(companionKind('/ru/solutions'), 'solutions')
  assert.equal(companionKind('/ru/builder'), 'builder')
  assert.equal(companionKind('/ru/cabinet/login'), 'cabinet')
  assert.equal(companionKind('/ru/ai-team/agent/director'), 'aiTeam')
  assert.equal(companionKind('/ru/blog/some-post'), 'blog')
  assert.equal(companionKind('/ru/how-we-work'), 'howWeWork')
  assert.equal(companionKind('/ru/pay-how'), 'other')
  assert.equal(companionKind('/ru/fira-lab'), null)
  assert.deepEqual(seenList(null), [])
  assert.deepEqual(seenList('not json'), [])
  assert.deepEqual(seenList('["/ru/a", 3]'), ['/ru/a'])
  assert.deepEqual(markSeen(['/a', '/b'], '/a'), ['/b', '/a'])
  assert.equal(markSeen(Array.from({ length: 60 }, (_, i) => `/p${i}`), '/x').length, 50)
  const widget = read('src/components/chat/chat-widget.tsx')
  assert.match(widget, /sessionStorage/)
  assert.match(widget, /FILM_EVENT/, 'the launcher steps aside while the film Fira is on screen')
  assert.match(widget, /FiraGuide/, 'Fira is the launcher')
  const guide = read('src/components/fira/fira-guide.tsx')
  assert.match(guide, /FiraFallback7/, 'the flat round-eight turtle is the face of the launcher')
  assert.match(guide, /sessionStorage|COMPANION_SEEN_KEY/)
})
