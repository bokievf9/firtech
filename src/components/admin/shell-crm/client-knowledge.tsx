'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { errText, fill, hq } from '@/components/admin/control/api'
import { btnPrimary, cn, inputClass } from '@/components/admin/kit'
import { Pending } from '@/components/ui/pending'
import { admin } from '@/content/admin'
import {
  checkAddress,
  isBusy,
  KNOWLEDGE_POLL_MS,
  normalizeClientKnowledge,
  normalizeImportReply,
  safePageHref,
  type ClientKnowledge,
  type KnowledgeState,
} from '@/lib/client-knowledge'
import { Chip, shortTime, type Tone } from './bits'
import { Empty, Loading, Offline, useHub } from '../hub/ui'

const k = admin.pult.clients.knowledge
const tone: Record<KnowledgeState, Tone> = { none: 'dim', pending: 'warn', queued: 'warn', running: 'warn', done: 'accent', failed: 'bad' }

// One client's knowledge: loads once, then asks again every 3 s while a crawl is running or queued and
// stops otherwise; a hidden tab pauses it and a return to the tab asks at once.
function useClientKnowledge(clientId: string) {
  const [data, setData] = useState<ClientKnowledge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busy = data ? isBusy(data.state) : false
  const alive = useRef(true)

  const load = useCallback(async () => {
    const res = await hq<Record<string, unknown>>(`clients/${clientId}/knowledge`)
    if (!alive.current) return
    if (!res.ok) return setError(res.error)
    const next = normalizeClientKnowledge(res)
    if (next) {
      setData(next)
      setError(null)
    } else setError('hq_bad_response')
  }, [clientId])

  useEffect(() => {
    alive.current = true
    const first = setTimeout(() => void load(), 0)
    return () => {
      alive.current = false
      clearTimeout(first)
    }
  }, [load])

  useEffect(() => {
    if (!busy) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      timer = setTimeout(async () => {
        if (!document.hidden) await load()
        if (alive.current) tick()
      }, KNOWLEDGE_POLL_MS)
    }
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [busy, load])

  return { data, error, reload: load }
}

export function ClientKnowledgePanel({ clientId }: { clientId: string }) {
  const { data, error, reload } = useClientKnowledge(clientId)
  const { notify } = useHub()
  const [address, setAddress] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (!data) return error ? <Offline error={error} onRetry={() => reload()} /> : <Loading rows={2} />
  const value = address ?? data.site
  const busy = isBusy(data.state)

  async function start() {
    const check = checkAddress(value)
    if (!check.ok) return setProblem(k.errors[check.code] ?? k.errors.invalid_url ?? null)
    setProblem(null)
    setPending(true)
    const res = await hq<Record<string, unknown>>(`clients/${clientId}/knowledge/import`, { url: check.url })
    setPending(false)
    if (!res.ok) return setProblem(k.errors[res.error] ?? errText(res.error))
    const reply = normalizeImportReply(res)
    notify(reply?.already ? k.already : k.started)
    await reload()
  }

  const job = data.job
  return (
    <section className="grid gap-4" aria-label={k.title} data-client-knowledge data-state={data.state}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{k.title}</h3>
        <span data-knowledge-state>
          <Chip tone={tone[data.state]}>{k.states[data.state]}</Chip>
        </span>
      </div>
      <p className="text-xs text-muted">{k.hint}</p>
      {data.pending && data.state === 'pending' ? (
        <p className="grid gap-0.5 rounded-xl border border-warn px-3 py-2 text-xs" data-knowledge-pending>
          <span className="font-medium text-warn">{k.pendingBadge}</span>
          <span className="break-all text-muted">{data.pending.url}</span>
          <span className="text-faint">{k.pendingHint}</span>
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['pages', data.pages],
            ['chunks', data.chunks],
            ['errors', data.errors],
          ] as const
        ).map(([key, n]) => (
          <div key={key} className="min-w-0 rounded-xl border border-line bg-inset px-3 py-2">
            <dt className="text-xs text-muted">{k.counters[key]}</dt>
            <dd className="text-sm font-medium tabular-nums" data-counter={key}>
              {n}
            </dd>
          </div>
        ))}
        <div className="min-w-0 rounded-xl border border-line bg-inset px-3 py-2">
          <dt className="text-xs text-muted">{k.counters.last}</dt>
          <dd className="truncate text-sm font-medium">{data.lastAt ? shortTime(data.lastAt) : k.never}</dd>
        </div>
      </dl>

      {job ? (
        <div className="grid gap-1 rounded-xl border border-line px-3 py-2 text-xs text-muted" data-knowledge-job>
          <span className="font-medium text-fg">
            {k.job.title}: {k.states[job.state]}, {k.job.origin[job.origin]}
          </span>
          <span className="break-words">
            {fill(k.job.summary, {
              pages: job.pages,
              chunks: job.chunks,
              chars: job.chars.toLocaleString('en-US'),
              skipped: job.skipped ? fill(k.job.skipped, { n: job.skipped }) : '',
              errors: job.errors ? fill(k.job.errors, { n: job.errors }) : '',
            })}
          </span>
          {job.url ? <span className="break-all">{job.url}</span> : null}
          {job.startedAt ? (
            <span>
              {k.job.started} {shortTime(job.startedAt)}
              {job.finishedAt ? `, ${k.job.finished.toLowerCase()} ${shortTime(job.finishedAt)}` : ''}
            </span>
          ) : null}
          {job.truncated ? <span className="text-warn">{k.job.truncated}</span> : null}
          {job.state === 'failed' && job.error ? (
            <span className="break-words text-danger">
              {k.job.reason}: {job.error}
            </span>
          ) : null}
        </div>
      ) : null}

      <form
        className="grid gap-2"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void start()
        }}
      >
        <label className="grid gap-1 text-xs text-muted">
          {k.address}
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            value={value}
            onChange={(event) => {
              setAddress(event.target.value)
              setProblem(null)
            }}
            placeholder={k.placeholder}
            aria-invalid={problem ? true : undefined}
            aria-describedby="client-knowledge-problem"
            maxLength={2048}
            disabled={busy}
            className={cn(inputClass, 'text-fg')}
          />
        </label>
        <p className="text-xs text-faint">{k.addressHint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Pending type="submit" pending={pending || busy} pendingLabel={k.importing} className={btnPrimary} data-import>
            {data.state === 'done' || data.state === 'failed' ? k.reimport : data.state === 'pending' ? k.importAnyway : k.import}
          </Pending>
        </div>
        <p id="client-knowledge-problem" role="alert" data-knowledge-problem className="text-xs text-danger empty:hidden">
          {problem}
        </p>
      </form>

      {data.instagram ? <p className="text-xs text-faint break-words">{fill(k.instagram, { handle: data.instagram })}</p> : null}

      <div className="grid gap-1.5">
        <h4 className="text-xs font-medium text-muted">
          {k.pages} <span className="tabular-nums text-faint">{data.items.length}</span>
        </h4>
        {data.items.length ? (
          <ul className="grid gap-1.5">
            {data.items.map((p) => {
              const href = safePageHref(p.url)
              return (
                <li key={p.url} data-knowledge-page className="grid min-w-0 gap-0.5 rounded-xl border border-line bg-inset px-3 py-2 text-sm">
                  <span className="truncate font-medium">{p.title || p.url}</span>
                  {href ? (
                    <a href={href} className="truncate text-xs text-accent-text underline-offset-2 hover:underline">
                      {p.url}
                    </a>
                  ) : (
                    <span className="truncate text-xs text-muted">{p.url}</span>
                  )}
                  <span className="text-xs text-faint tabular-nums">
                    {p.chars.toLocaleString('en-US')} chars{p.fetchedAt ? ` · ${shortTime(p.fetchedAt)}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>{data.state === 'failed' ? k.emptyAfterFail : k.empty}</Empty>
        )}
      </div>
    </section>
  )
}
