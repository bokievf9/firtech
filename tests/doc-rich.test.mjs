import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blockHtml, docFromDom, docHtml, isPlaceholderText, parseDoc, splitCells } from '../src/lib/doc-rich.ts'

// A tiny parser for exactly the HTML the renderer writes (no attribute quoting tricks), producing the
// structural nodes the serializer reads. Enough to run md -> html -> tree -> md without a browser.
const VOID = new Set(['br', 'hr'])
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
function tree(html) {
  const root = { nodeType: 1, nodeName: 'DIV', nodeValue: null, childNodes: [], attrs: {} }
  const stack = [root]
  const re = /<(\/?)([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)*)\s*>|([^<]+)/g
  for (const m of html.matchAll(re)) {
    const top = stack.at(-1)
    if (m[4] !== undefined) top.childNodes.push({ nodeType: 3, nodeName: '#text', nodeValue: unesc(m[4]), childNodes: [] })
    else if (m[1]) stack.pop()
    else {
      const attrs = {}
      for (const a of m[3].matchAll(/([a-z-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = unesc(a[2] ?? '')
      const el = { nodeType: 1, nodeName: m[2].toUpperCase(), nodeValue: null, childNodes: [], attrs, getAttribute: (n) => attrs[n] ?? null }
      top.childNodes.push(el)
      if (!VOID.has(m[2])) stack.push(el)
    }
  }
  return root
}
const roundTrip = (md) => docFromDom(tree(docHtml(parseDoc(md))))

const canonical = {
  headings: '# Коммерческое предложение\n\n## Что мы сделаем\n\n### Мелкий заголовок',
  inline: 'Итого **450 USD**, оплата *по этапам*, см. `код` и [сайт](https://firtech.pro/ru).',
  nested: 'Это **жирный и *курсив* внутри** текст.',
  list: '- Первый пункт\n- Второй **важный**\n  - Вложенный\n  - Ещё один\n- Третий',
  ordered: '1. Разбор: 3 дня.\n2. Тесты: 4 дня.\n3. Запуск.',
  table: '| Этап | Что входит | Сумма |\n|---|---|---|\n| 1 | Дизайн | $325 |\n| 2 | Запуск | $325 |',
  quote: '> Мы отвечаем за один рабочий день.\n> Обычно быстрее.',
  hr: 'Абзац\n\n---\n\nДругой абзац',
  lines: 'Первая строка\nвторая строка\nтретья',
  ph: 'Срок: [срок], сумма [сумма этапа] USD, подпись [дата].',
  mixed: '# Договор\n\nТекст **договора**.\n\n- а\n- б\n\n1. раз\n2. два\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> цитата\n\nКонец.',
}

for (const [name, md] of Object.entries(canonical)) {
  test(`round trip through the rendered tree: ${name}`, () => {
    assert.equal(roundTrip(md), md)
  })
}

test('an untouched block is written back byte for byte, odd spacing included', () => {
  const md = '\n\n#   Заголовок  \n\n\n\nТекст   с   пробелами.  \n* звёздочка\n+ плюс\n\n'
  const doc = parseDoc(md)
  const root = tree(docHtml(doc))
  const recs = new Map(root.childNodes.map((el, i) => [el, doc.blocks[i]]))
  assert.equal(docFromDom(root, { keep: (n) => recs.get(n) ?? null, tail: doc.tail }), md)
})

test('editing one block normalizes only that block', () => {
  const md = '#  Один\n\n\nАбзац   два.\n\nТретий.'
  const doc = parseDoc(md)
  const root = tree(docHtml(doc))
  const recs = new Map(root.childNodes.map((el, i) => [el, doc.blocks[i]]))
  root.childNodes[1].childNodes[0].nodeValue = 'Абзац два, изменён.'
  recs.delete(root.childNodes[1])
  assert.equal(docFromDom(root, { keep: (n) => recs.get(n) ?? null, tail: doc.tail }), '#  Один\n\nАбзац два, изменён.\n\nТретий.')
})

test('placeholders are marked, links with a bracket pair are not placeholders', () => {
  assert.match(docHtml(parseDoc('Срок [срок].')), /<mark data-ph>\[срок\]<\/mark>/)
  assert.doesNotMatch(docHtml(parseDoc('Смотрите [здесь](https://x.pro).')), /data-ph/)
  assert.ok(isPlaceholderText('[сумма этапа]'))
  assert.ok(!isPlaceholderText('[a]'))
})

test('raw html, unknown syntax and unsafe links stay literal text and survive', () => {
  const md = 'Строка <b>тег</b> & амперсанд, [плохая](javascript:alert(1)) ссылка, _подчёркивание_.'
  assert.equal(roundTrip(md), md)
  assert.ok(!docHtml(parseDoc(md)).includes('<b>'))
})

test('fenced code is a locked raw block', () => {
  const md = 'До\n\n```\nconst a = 1;\n| not | a table |\n```\n\nПосле'
  const doc = parseDoc(md)
  assert.deepEqual(doc.blocks.map((b) => b.kind), ['p', 'raw', 'p'])
  assert.match(blockHtml(doc.blocks[1]), /contenteditable="false"/)
})

test('block kinds: a list can interrupt a paragraph, a table needs its divider', () => {
  assert.deepEqual(parseDoc('Текст\n- пункт').blocks.map((b) => b.kind), ['p', 'ul'])
  assert.deepEqual(parseDoc('a | b\nно не таблица').blocks.map((b) => b.kind), ['p'])
  assert.deepEqual(parseDoc('| a | b |\n|---|---|\n| 1 | 2 |').blocks.map((b) => b.kind), ['table'])
  assert.deepEqual(parseDoc('1. a\n\n2. b').blocks.map((b) => b.kind), ['ol'])
})

test('a pipe typed in a table cell is escaped and read back', () => {
  assert.deepEqual(splitCells('| a \\| b | c |'), ['a | b', 'c'])
  const root = tree('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>x | y</td><td>z</td></tr></tbody></table>')
  assert.equal(docFromDom(root), '| A | B |\n|---|---|\n| x \\| y | z |')
})

test('what the browser leaves behind: bare text, divs, nbsp, bold with edge spaces, trailing br', () => {
  const root = tree('Просто текст<div>строка в div</div><p>Слово <b>жирное</b> слово\u00a0тут<br></p><ul><li>один</li><li></li><li>два</li></ul>')
  assert.equal(docFromDom(root), 'Просто текст\n\nстрока в div\n\nСлово **жирное** слово тут\n\n- один\n- два')
  assert.equal(docFromDom(tree('<p>a<b> bold </b>c</p>')), 'a **bold** c')
})

test('an emptied page gives an empty text and an empty text gives one empty paragraph', () => {
  assert.equal(docFromDom(tree('<p><br></p>')), '')
  assert.equal(docHtml(parseDoc('')), '<p><br></p>')
})

test('Russian text with quotes and a long dash passes through unchanged', () => {
  const md = 'Исполнитель «Fir Tech» обязуется выполнить работу — в срок.'
  assert.equal(roundTrip(md), md)
})
