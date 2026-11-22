// Cabinet document text (2026-11-23): the safe markdown subset, the text field of cabinet documents, the dev mock.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const src = pathToFileURL(path.resolve('src') + '/').href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,export{}', shortCircuit: true }
    if (specifier.startsWith('@/')) {
      const base = new URL(specifier.slice(2), src).href
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return next(candidate, context)
        } catch {}
      }
    }
    return next(specifier, context)
  },
})

const docs = await import('../src/lib/cabinet-docs.ts')
const md = await import('../src/lib/cabinet-markdown.ts')
const mock = await import('../src/lib/cabinet-hq-mock.ts')

const raw = (o = {}) => ({ id: 'd1', kind: 'quote', title: 'КП', state: 'awaiting_client', ...o })
const flat = (blocks) => JSON.stringify(blocks)

test('markdown subset: headings, paragraphs, lists, bold, italic, rule', () => {
  const b = md.parseMarkdown('# Договор\n\nПервая строка\nвторая **важно** и *тут*\n\n- один\n- два\n\n1. a\n2. b\n\n---\n## Раздел')
  assert.deepEqual(b.map((x) => x.kind), ['heading', 'paragraph', 'list', 'list', 'rule', 'heading'])
  assert.equal(b[0].level, 1)
  assert.equal(b[5].level, 2)
  assert.deepEqual(b[1].inline.map((i) => i.kind), ['text', 'strong', 'text', 'em'])
  assert.equal(b[1].inline[0].text, 'Первая строка вторая ')
  assert.equal(b[2].ordered, false)
  assert.equal(b[3].ordered, true)
  assert.equal(b[2].items.length, 2)
})

test('markdown subset: HTML, links and scripts stay literal text, no node can carry markup', () => {
  const evil = '<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n![x](http://evil/a.png)\n\n<img src=x onerror=alert(1)>\n\n# <b>h</b>\n\n- <a href="x">y</a>'
  const b = md.parseMarkdown(evil)
  // Only the four known block kinds and the three inline kinds exist, the tags are plain strings.
  assert.ok(b.every((x) => ['heading', 'paragraph', 'list', 'rule'].includes(x.kind)))
  const kinds = new Set()
  const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.kind) kinds.add(x.kind); Object.values(x).forEach(walk) } }
  walk(b)
  assert.deepEqual([...kinds].filter((k) => !['heading', 'paragraph', 'list', 'rule', 'text', 'strong', 'em'].includes(k)), [])
  assert.match(flat(b), /<script>alert\(1\)<\/script>/)
  assert.ok(Object.values(b[0]).every((v) => typeof v === 'string' || Array.isArray(v)))
})

test('markdown subset: control characters, bidi marks, non-strings and huge input are handled', () => {
  assert.deepEqual(md.parseMarkdown(null), [])
  assert.deepEqual(md.parseMarkdown(42), [])
  assert.deepEqual(md.parseMarkdown('   \n '), [])
  const b = md.parseMarkdown('a\u0000b‮c\r\nd')
  assert.equal(b[0].inline[0].text, 'abc d')
  const huge = md.parseMarkdown('x'.repeat(md.MAX_DOC_TEXT * 3))
  assert.equal(huge[0].inline[0].text.length, md.MAX_DOC_TEXT)
  // Unclosed emphasis is literal.
  assert.deepEqual(md.parseInline('2 * 3 and **open'), [{ kind: 'text', text: '2 * 3 and **open' }])
})

test('cabinet docs: text passes through, is capped and null when absent or blank', () => {
  const [a, b, c, d] = docs.parseClientDocs([
    raw({ id: 'a', text: '# КП\n\nТекст' }),
    raw({ id: 'b' }),
    raw({ id: 'c', text: '   ' }),
    raw({ id: 'd', text: 'x'.repeat(docs.DOC_TEXT_MAX + 500) }),
  ])
  assert.equal(a.text, '# КП\n\nТекст')
  assert.equal(b.text, null)
  assert.equal(c.text, null)
  assert.equal(d.text.length, docs.DOC_TEXT_MAX)
  assert.equal(docs.parseClientDoc(raw({ id: 'e', text: 5 })).text, null)
  assert.equal(docs.publicDoc(a).text, '# КП\n\nТекст')
  assert.equal('pdfUrl' in docs.publicDoc(a), false)
})

test('cabinet docs: the viewer body is text first, then the PDF, else missing', () => {
  assert.equal(docs.docBody({ text: 'x', hasPdf: true }), 'text')
  assert.equal(docs.docBody({ text: 'x', hasPdf: false }), 'text')
  assert.equal(docs.docBody({ text: null, hasPdf: true }), 'pdf')
  assert.equal(docs.docBody({ text: null, hasPdf: false }), 'missing')
})

test('dev mock: the quote and the contract carry readable markdown, one declined quote has neither text nor file', async () => {
  const res = await (await import('../src/lib/cabinet-hq.ts')).fetchClientDocuments(1, {})
  assert.ok(res.ok)
  const by = (id) => res.data.find((d) => d.id === id)
  assert.match(by('q-14').text, /^# Коммерческое предложение/)
  assert.match(by('c-2').text, /## 1\. Предмет договора/)
  assert.doesNotMatch(by('c-2').text, /Подписи сторон/)
  assert.equal(by('q-7').text, null)
  assert.equal(by('q-7').pdfUrl, null)
  assert.ok(md.parseMarkdown(by('q-14').text).some((b) => b.kind === 'list' && b.ordered))
  assert.equal(typeof mock.mockPdf, 'function')
})
