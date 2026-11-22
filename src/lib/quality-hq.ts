// HQ «Quality» (2026-11-23): view models of `GET /admin/quality/lessons` and `GET /admin/quality/eval` (contract
// `docs/briefs/fira/knowledge-quality-api.md`) and the rating form. No I/O, no React; unknown fields are dropped.

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

export const LESSON_SOURCES = ['review', 'thread', 'rating'] as const
export type LessonSource = (typeof LESSON_SOURCES)[number]
export const isLessonSource = (v: unknown): v is LessonSource => typeof v === 'string' && (LESSON_SOURCES as readonly string[]).includes(v)

export type Lesson = { id: string; question: string; bad: string; good: string; tag: string; source: LessonSource; at: string | null }

export function normalizeLessons(body: unknown): Lesson[] | null {
  const b = rec(body)
  if (!Array.isArray(b.items)) return null
  const out: Lesson[] = []
  for (const raw of b.items.slice(0, 500)) {
    const r = rec(raw)
    const id = str(r.id, 64)
    if (!/^[\w-]{1,64}$/.test(id) || !isLessonSource(r.source)) continue
    const at = typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)) ? r.at : null
    out.push({ id, question: str(r.question), bad: str(r.bad), good: str(r.good), tag: str(r.tag, 40), source: r.source, at })
  }
  return out
}

export type Ratio = { passed: number; total: number }
export type EvalRun = { at: string | null; runtime: 'fira' | 'legacy'; lead: Ratio; red: Ratio; handoffRate: number | null; toolRate: number | null }
export type EvalReport = { last: EvalRun | null }

const ratio = (v: unknown): Ratio => {
  const r = rec(v)
  const total = count(r.total)
  return { passed: Math.min(count(r.passed), total), total }
}
// A rate may come as a share (0..1) or already as percent (1..100): both end up as a whole percent.
const rate = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(100, Math.round(v <= 1 ? v * 100 : v)) : null

export function normalizeEval(body: unknown): EvalReport | null {
  const b = rec(body)
  if (!('last' in b)) return null
  if (b.last === null) return { last: null }
  const r = rec(b.last)
  const at = typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)) ? r.at : null
  return { last: { at, runtime: r.runtime === 'fira' ? 'fira' : 'legacy', lead: ratio(r.lead), red: ratio(r.red), handoffRate: rate(r.handoffRate), toolRate: rate(r.toolRate) } }
}

export const percent = (r: Ratio): number | null => (r.total > 0 ? Math.round((r.passed / r.total) * 100) : null)
// The red series (adversarial scenarios) is red as soon as one of them failed; an empty series is not green either.
export const redStatus = (r: Ratio): 'green' | 'red' | 'empty' => (r.total === 0 ? 'empty' : r.passed < r.total ? 'red' : 'green')

export type RateDraft = { messageId: string; thread: string; value: 1 | -1 | null; note: string }
export const emptyRate: RateDraft = { messageId: '', thread: '', value: null, note: '' }
const KEY = /^[\w:.-]{1,64}$/
// null = fine, otherwise a key of the texts; a thumb down needs a note to become a lesson.
export function rateProblem(d: RateDraft): 'message' | 'thread' | 'value' | 'note' | null {
  if (!KEY.test(d.messageId.trim())) return 'message'
  if (!KEY.test(d.thread.trim())) return 'thread'
  if (d.value === null) return 'value'
  if (d.note.length > 1000) return 'note'
  return null
}
export function rateBody(d: RateDraft): { messageId: string; thread: string; value: 1 | -1; note?: string } | null {
  if (rateProblem(d) || d.value === null) return null
  const note = d.note.trim()
  return { messageId: d.messageId.trim(), thread: d.thread.trim(), value: d.value, ...(note ? { note } : {}) }
}
