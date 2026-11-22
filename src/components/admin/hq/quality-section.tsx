'use client'

import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { useState } from 'react'
import { fill, hq, hqDelete } from '@/components/admin/control/api'
import { btn, btnPrimary, Empty, inputClass, Loading, Offline, useHqView } from '@/components/admin/hub/ui'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { sectionById } from '@/lib/hq-shell'
import { emptyRate, normalizeEval, normalizeLessons, normalizeRatings, percent, RATINGS_PATH, rateBody, rateProblem, redStatus, withRating, type EvalRun, type Lesson, type RateDraft, type Ratio } from '@/lib/quality-hq'
import { Fail, TwoStepDelete, when } from './kq-ui'

const t = admin.hq
const q = admin.hq.quality
const TABS = ['lessons', 'ratings', 'eval'] as const
type Tab = (typeof TABS)[number]

const card = 'rounded-card border border-line bg-surface p-4'

function LessonCard({ lesson, onGone }: { lesson: Lesson; onGone: (id: string) => void }) {
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await hqDelete(`quality/lessons/${encodeURIComponent(lesson.id)}`)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onGone(lesson.id)
  }
  return (
    <li className={cn(card, 'grid gap-3')} data-lesson={lesson.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="rounded-full border border-line-strong px-2 py-0.5">{q.sources[lesson.source]}</span>
        {lesson.tag ? <span className="font-mono">{lesson.tag}</span> : null}
        <span className="font-mono">{when(lesson.at)}</span>
      </div>
      <div>
        <p className="text-xs text-muted">{q.question}</p>
        <p className="text-sm font-medium whitespace-pre-wrap">{lesson.question}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
          <p className="text-xs text-danger">{q.bad}</p>
          <p className="text-sm whitespace-pre-wrap">{lesson.bad}</p>
        </div>
        <div className="rounded-xl border border-accent-text/40 p-3">
          <p className="text-xs text-accent-text">{q.good}</p>
          <p className="text-sm whitespace-pre-wrap">{lesson.good}</p>
        </div>
      </div>
      <TwoStepDelete
        open={ask}
        onOpen={() => setAsk(true)}
        onCancel={() => setAsk(false)}
        onConfirm={() => void remove()}
        pending={busy}
        testId={`lesson-${lesson.id}`}
        labels={{ delete: q.delete, ask: q.deleteAsk, yes: q.deleteYes, no: q.deleteNo, busy: q.deleting }}
      />
      {error ? <Fail code={error} onRetry={() => void remove()} /> : null}
    </li>
  )
}

function LessonsTab() {
  const view = useHqView('quality/lessons?limit=100', normalizeLessons, { visible: 60_000, hidden: 180_000 })
  const lessons = view.view
  if (view.error && !lessons) return <Offline error={view.error} onRetry={view.reload} />
  if (!lessons) return <Loading rows={3} />
  return (
    <div className="grid gap-3 p-3 sm:p-4" data-quality-tab="lessons">
      {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
      {lessons.length === 0 ? <Empty>{q.lessonsEmpty}</Empty> : null}
      <ul className="grid gap-3" data-lessons-list>
        {lessons.map((l) => (
          <LessonCard key={l.id} lesson={l} onGone={(id) => view.mutate((cur) => cur.filter((x) => x.id !== id))} />
        ))}
      </ul>
      {lessons.length > 0 ? <p className="text-center text-xs text-faint">{fill(q.lessonsShown, { n: lessons.length })}</p> : null}
    </div>
  )
}

// The real list of ratings (`GET quality/ratings`) and a form to rate a reply by its id (a repeat replaces the earlier rating).
function RatingsTab() {
  const [draft, setDraft] = useState<RateDraft>(emptyRate)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const list = useHqView(RATINGS_PATH, normalizeRatings, { visible: 60_000, hidden: 180_000 })
  const ratings = list.view

  const send = async () => {
    if (busy) return
    const p = rateProblem(draft)
    setProblem(p ? q.problems[p] : null)
    setDone(null)
    const body = rateBody(draft)
    if (p || !body) return
    setBusy(true)
    setError(null)
    const res = await hq<{ id?: unknown; lessonId?: unknown }>('quality/rate', body)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const lesson = typeof res.lessonId === 'string' && res.lessonId.length > 0
    setDone(lesson ? q.sentLesson : q.sent)
    list.mutate((cur) => withRating(cur, { id: typeof res.id === 'string' ? res.id : `${body.thread}:${body.messageId}`, messageId: body.messageId, thread: body.thread, value: body.value, note: body.note ?? '', at: new Date().toISOString() }))
    setDraft({ ...emptyRate, thread: draft.thread })
  }

  return (
    <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-2" data-quality-tab="ratings">
      <form
        className={cn(card, 'grid gap-3')}
        aria-label={q.tabs.ratings}
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <h2 className="text-sm font-medium">{q.rateByIdTitle}</h2>
        <p className="text-sm text-muted">{q.ratingsIntro}</p>
        <label className="grid gap-1 text-xs text-muted">
          {q.messageId}
          <input className={inputClass} value={draft.messageId} maxLength={64} onChange={(e) => setDraft({ ...draft, messageId: e.target.value })} />
        </label>
        <label className="grid gap-1 text-xs text-muted">
          {q.thread}
          <input className={inputClass} value={draft.thread} maxLength={64} onChange={(e) => setDraft({ ...draft, thread: e.target.value })} />
        </label>
        <div role="group" aria-label={q.tabs.ratings} className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={draft.value === 1} className={cn(btn, draft.value === 1 && 'border-accent-text text-accent-text')} onClick={() => setDraft({ ...draft, value: 1 })} data-rate-up>
            <ThumbsUp size={16} aria-hidden="true" />
            {q.up}
          </button>
          <button type="button" aria-pressed={draft.value === -1} className={cn(btn, draft.value === -1 && 'border-danger text-danger')} onClick={() => setDraft({ ...draft, value: -1 })} data-rate-down>
            <ThumbsDown size={16} aria-hidden="true" />
            {q.down}
          </button>
        </div>
        <label className="grid gap-1 text-xs text-muted">
          {q.note}
          <textarea className={cn(inputClass, 'min-h-24')} value={draft.note} maxLength={1000} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </label>
        {problem ? (
          <p role="alert" className="text-sm text-danger" data-rate-problem>
            {problem}
          </p>
        ) : null}
        {error ? <Fail code={error} onRetry={() => void send()} /> : null}
        {done ? (
          <p role="status" className="text-sm text-accent-text" data-rate-done>
            {done}
          </p>
        ) : null}
        <div>
          <Pending type="submit" pending={busy} pendingLabel={q.sending} className={btnPrimary}>
            {q.send}
          </Pending>
        </div>
      </form>
      <section className={card} aria-label={q.history}>
        <h2 className="mb-2 text-sm font-medium">{q.history}</h2>
        {list.error && !ratings ? <Offline error={list.error} onRetry={list.reload} /> : null}
        {!ratings && !list.error ? <Loading rows={3} /> : null}
        {list.failed && ratings ? <Offline error={list.failed} onRetry={list.reload} /> : null}
        {ratings && ratings.length === 0 ? <p className="text-sm text-muted">{q.historyEmpty}</p> : null}
        <ul className="grid gap-2" data-rating-history>
          {(ratings ?? []).map((h) => (
            <li key={h.id} className="grid gap-0.5 text-sm" data-rating-item={h.messageId} data-value={h.value}>
              <span className="flex flex-wrap items-center gap-2">
                {h.value === 1 ? <ThumbsUp size={16} className="text-accent-text" aria-label={q.up} /> : <ThumbsDown size={16} className="text-danger" aria-label={q.down} />}
                <span className="font-mono text-xs">{h.messageId}</span>
                <span className="text-xs text-muted">{h.thread}</span>
                <span className="font-mono text-xs text-faint">{when(h.at)}</span>
              </span>
              {h.note ? <span className="text-xs text-muted whitespace-pre-wrap">{h.note}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Bar({ value, tone }: { value: number | null; tone: 'ok' | 'bad' }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
      <div className={cn('h-full rounded-full', tone === 'ok' ? 'bg-accent' : 'bg-danger')} style={{ width: `${value ?? 0}%` }} />
    </div>
  )
}

function Stat({ label, ratio, tone, id }: { label: string; ratio: Ratio; tone: 'ok' | 'bad'; id: string }) {
  const p = percent(ratio)
  return (
    <div className={card} data-eval-stat={id}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{p === null ? q.noData : `${p}%`}</p>
      <p className="mb-2 text-xs text-muted">{fill(q.passed, { p: ratio.passed, t: ratio.total })}</p>
      <Bar value={p} tone={tone} />
    </div>
  )
}

function RateStat({ label, value, id }: { label: string; value: number | null; id: string }) {
  return (
    <div className={card} data-eval-stat={id}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value === null ? q.noData : `${value}%`}</p>
      <Bar value={value} tone="ok" />
    </div>
  )
}

function EvalCard({ run }: { run: EvalRun }) {
  const red = redStatus(run.red)
  return (
    <div className="grid gap-3" data-eval-report>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{fill(q.evalLast, { d: when(run.at) })}</span>
        <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs">
          {q.runtime}: {q.runtimes[run.runtime]}
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat id="lead" label={q.lead} ratio={run.lead} tone="ok" />
        <div className={cn(card, red === 'red' && 'border-danger/60')} data-eval-stat="red" data-red-status={red}>
          <p className="text-xs text-muted">{q.red}</p>
          <p className="mt-1 text-2xl font-medium tabular-nums">{percent(run.red) === null ? q.noData : `${percent(run.red)}%`}</p>
          <p className="mb-2 text-xs text-muted">{fill(q.passed, { p: run.red.passed, t: run.red.total })}</p>
          <Bar value={percent(run.red)} tone={red === 'red' ? 'bad' : 'ok'} />
          <p className={cn('mt-2 text-xs', red === 'red' ? 'font-medium text-danger' : 'text-muted')}>
            {red === 'red' ? fill(q.redRed, { n: run.red.total - run.red.passed }) : red === 'green' ? q.redGreen : q.redEmpty}
          </p>
        </div>
        <RateStat id="handoff" label={q.handoff} value={run.handoffRate} />
        <RateStat id="tools" label={q.tools} value={run.toolRate} />
      </div>
    </div>
  )
}

function EvalTab() {
  const view = useHqView('quality/eval', normalizeEval, { visible: 60_000, hidden: 180_000 })
  const report = view.view
  if (view.error && !report) return <Offline error={view.error} onRetry={view.reload} />
  if (!report) return <Loading rows={2} />
  return (
    <div className="p-3 sm:p-4" data-quality-tab="eval">
      {view.failed ? <Offline error={view.failed} onRetry={view.reload} /> : null}
      {report.last ? <EvalCard run={report.last} /> : <Empty>{q.evalEmpty}</Empty>}
    </div>
  )
}

// Quality: lessons learned from bad answers (delete), ratings of agent replies and the last eval run.
// Reads `GET /admin/quality/lessons` and `/eval`, rates through `POST /admin/quality/rate`.
export function QualitySection() {
  const info = sectionById('quality')!
  const [tab, setTab] = useState<Tab>('lessons')
  return (
    <div className="flex min-h-full flex-col" data-section-view="quality">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3 sm:px-5">
          <h1 className="font-brand text-xl">{info.label}</h1>
          <p className="text-sm text-muted">{t.sectionHints.quality}</p>
        </div>
        <div role="tablist" aria-label={info.label} className="flex gap-1 overflow-x-auto px-3 sm:px-4">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === tab}
              onClick={() => setTab(id)}
              className={cn(
                'relative inline-flex min-h-11 shrink-0 items-center px-3 text-sm transition-colors',
                id === tab ? 'text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg',
              )}
            >
              {q.tabs[id]}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {tab === 'lessons' ? <LessonsTab /> : null}
        {tab === 'ratings' ? <RatingsTab /> : null}
        {tab === 'eval' ? <EvalTab /> : null}
      </div>
    </div>
  )
}
