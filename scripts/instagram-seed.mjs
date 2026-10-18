// Builds src/content/ig-schedule.json (the calendar the panel seeds instagram.json from) out of the
// Instagram posting schedule. Run once, from the repo root, on 2026-10-18:
//   node scripts/instagram-seed.mjs <path to marketing/instagram/publish/schedule.md>
// (the file lives on branch instagram-launch). The JSON is committed; rerun only if the schedule changes.
import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2]
if (!source) {
  console.error('Usage: node scripts/instagram-seed.mjs <schedule.md>')
  process.exit(1)
}

const months = { октября: 10, ноября: 11 }
const year = 2026
const clean = (s) => s.replaceAll('`', '').trim()
const kindOf = (title, folder) => {
  const m = folder?.match(/^\d+_(post|stories|reel)_/)
  if (m) return m[1]
  return /^Сторис/.test(title) ? 'stories' : 'task'
}

const items = []
const used = new Map()
let date = null
for (const line of readFileSync(source, 'utf8').split('\n')) {
  const heading = line.match(/^### [^,]+, (\d+) (\S+)$/)
  if (heading) {
    const month = months[heading[2]]
    date = month ? `${year}-${String(month).padStart(2, '0')}-${heading[1].padStart(2, '0')}` : null
    continue
  }
  const row = line.match(/^\| (\d{2}:\d{2}) \| (.+?) \| (.+?) \| (.+?) \|$/)
  if (!row || !date) continue
  const [, time, what, folderCell, why] = row
  const title = clean(what)
  const folderText = clean(folderCell)
  const folder = /^\d+_/.test(folderText) ? folderText : null
  const kind = kindOf(title, folder)
  const base = `${date}-${time.replace(':', '')}-${folder ?? kind}`
  const n = (used.get(base) ?? 0) + 1
  used.set(base, n)
  const note = folder || folderText === '-' ? clean(why) : `${clean(why)} (${folderText})`
  items.push({ id: n > 1 ? `${base}_${n}` : base, date, time, kind, title, folder, note })
}

// Mentioned in prose under "Суббота и воскресенье", not in a table.
items.push({
  id: '2026-10-24-1200-stories',
  date: '2026-10-24',
  time: '12:00',
  kind: 'stories',
  title: 'Сторис с наклейкой «Вопрос»: что хотите спросить про сайт или бота?',
  folder: null,
  note: 'Ответы выложить в понедельник и добавить в «Актуальное» «Вопросы»',
})

items.sort((a, b) => (a.date + a.time + a.id).localeCompare(b.date + b.time + b.id))
writeFileSync(new URL('../src/content/ig-schedule.json', import.meta.url), JSON.stringify(items, null, 2) + '\n')
console.log(`${items.length} items, ${items[0].date}..${items.at(-1).date}`)
