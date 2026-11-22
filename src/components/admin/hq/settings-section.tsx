'use client'

import { Check, WarningCircle } from '@phosphor-icons/react'
import { useCallback, useId, useRef, useState } from 'react'
import { errText, fill, hqPatch } from '@/components/admin/control/api'
import { Loading, Offline, inputClass, useConfirm, useHqView } from '@/components/admin/hub/ui'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import {
  AUTOPILOT_MODES,
  buildPatch,
  buildTrustPatch,
  FIELD_GROUPS,
  getValue,
  normalizeLog,
  normalizeSettings,
  validateField,
  type AutopilotMode,
  type FieldSpec,
  type GroupId,
  type Settings,
  type TrustKind,
} from '@/lib/settings-hq'

const t = admin.hq.settings
const GROUP_ORDER: GroupId[] = ['schedule', 'notices', 'alerts', 'limits', 'calls', 'kp', 'playground', 'service']
const usd = (n: number) => `$${n.toFixed(n >= 10 ? 0 : 2)}`
const stamp = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

type Saved = { ok: true } | { ok: false; error: string }
type Save = (patch: Record<string, unknown>) => Promise<Saved>
type Status = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string }

// One save at a time per field: shows «Saving», then «Saved» for two seconds, or the error under the control.
function useFieldStatus() {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const run = useCallback(async (job: () => Promise<Saved>) => {
    if (timer.current) clearTimeout(timer.current)
    setStatus({ state: 'saving' })
    const r = await job()
    if (r.ok) {
      setStatus({ state: 'saved' })
      timer.current = setTimeout(() => setStatus({ state: 'idle' }), 2000)
    } else setStatus({ state: 'error', message: r.error })
    return r
  }, [])
  return { status, run, fail: (message: string) => setStatus({ state: 'error', message }), clear: () => setStatus({ state: 'idle' }) }
}

function StatusMark({ status }: { status: Status }) {
  return (
    <span className="min-h-5 text-xs" role={status.state === 'error' ? 'alert' : 'status'} data-status={status.state}>
      {status.state === 'saving' ? <span className="text-muted">{t.saving}</span> : null}
      {status.state === 'saved' ? (
        <span className="inline-flex items-center gap-1 text-accent-text">
          <Check size={12} aria-hidden="true" />
          {t.saved}
        </span>
      ) : null}
      {status.state === 'error' ? (
        <span className="inline-flex items-start gap-1 text-danger">
          <WarningCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {status.message}
        </span>
      ) : null}
    </span>
  )
}

function Switch({ on, onChange, label, busy, id }: { on: boolean; onChange: (v: boolean) => void; label: string; busy?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60', on ? 'border-accent bg-accent' : 'border-line-strong bg-field')}
    >
      <span className={cn('absolute size-5 rounded-full transition-all', on ? 'left-6 bg-accent-ink' : 'left-1 bg-muted')} />
    </button>
  )
}

function Row({ spec, label, settings, onSave, hint, disabled, extra }: { spec: FieldSpec; label?: string; settings: Settings; onSave: Save; hint?: React.ReactNode; disabled?: boolean; extra?: React.ReactNode }) {
  const id = useId()
  const { status, run, fail, clear } = useFieldStatus()
  const current = getValue(settings, spec.path)
  const [draft, setDraft] = useState<string | null>(null)
  const text = label ?? (t.fields as Record<string, string>)[spec.path] ?? spec.path
  const shown = draft ?? String(current)

  const commit = async (raw: string | number | boolean) => {
    const value = spec.kind === 'int' || spec.kind === 'usd' ? Number(raw) : spec.kind === 'tz' ? String(raw).trim() : raw
    if (value === current) {
      setDraft(null)
      clear()
      return
    }
    const bad = validateField(spec, value)
    if (bad) {
      fail((t.errors as Record<string, string>)[bad]?.replace('{min}', String(spec.min ?? '')).replace('{max}', String(spec.max ?? '')) ?? bad)
      return
    }
    const r = await run(() => onSave(buildPatch(settings, spec.path, value)))
    if (r.ok) setDraft(null)
  }

  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-start sm:gap-4" data-field={spec.path} data-status={status.state}>
      <label htmlFor={id} className="text-sm">
        {text}
        {hint ? <span className="block text-xs text-faint">{hint}</span> : null}
      </label>
      <div className="grid gap-1 sm:justify-items-end">
        {spec.kind === 'bool' ? (
          <Switch id={id} on={Boolean(current)} label={text} busy={status.state === 'saving' || disabled} onChange={(v) => void commit(v)} />
        ) : spec.kind === 'select' ? (
          <select id={id} value={String(current)} disabled={disabled || status.state === 'saving'} onChange={(e) => void commit(spec.path === 'schedule.digestDay' ? Number(e.target.value) : e.target.value)} className={cn(inputClass, 'sm:w-48')}>
            {spec.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={spec.kind === 'time' ? 'time' : spec.kind === 'tz' ? 'text' : 'number'}
            inputMode={spec.kind === 'int' || spec.kind === 'usd' ? 'decimal' : undefined}
            min={spec.min}
            max={spec.max}
            step={spec.kind === 'usd' ? 1 : spec.kind === 'int' ? 1 : undefined}
            value={shown}
            disabled={disabled}
            aria-invalid={status.state === 'error' || undefined}
            onChange={(e) => {
              setDraft(e.target.value)
              if (status.state === 'error') clear()
            }}
            onBlur={() => draft !== null && void commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraft(null)
                clear()
              }
            }}
            className={cn(inputClass, 'sm:w-48', spec.kind !== 'tz' && 'font-mono tabular-nums')}
          />
        )}
        {extra}
        <StatusMark status={status} />
      </div>
    </div>
  )
}

function Card({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-4" data-group={id}>
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-2 divide-y divide-line">{children}</div>
    </section>
  )
}

function Autopilot({ mode, onSave }: { mode: AutopilotMode; onSave: Save }) {
  const { status, run } = useFieldStatus()
  const a = t.autopilot
  return (
    <section className="rounded-card border border-accent/40 bg-surface p-4" data-group="autopilot" data-status={status.state}>
      <h2 className="text-sm font-medium">{a.title}</h2>
      <p className="mt-0.5 text-xs text-muted">{a.hint}</p>
      <div role="radiogroup" aria-label={a.label} className="mt-3 grid gap-2">
        {AUTOPILOT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            data-mode={m}
            disabled={status.state === 'saving'}
            onClick={() => mode !== m && void run(() => onSave({ autopilot: { leadManager: m } }))}
            className={cn('flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60', mode === m ? 'border-accent bg-surface-2' : 'border-line hover:border-line-strong')}
          >
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', mode === m ? 'border-accent' : 'border-line-strong')} aria-hidden="true">
              {mode === m ? <span className="size-2 rounded-full bg-accent" /> : null}
            </span>
            {a.modes[m]}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <StatusMark status={status} />
      </div>
    </section>
  )
}

function TrustRow({ kind, onSave }: { kind: TrustKind; onSave: Save }) {
  const { status, run, fail } = useFieldStatus()
  const { ask, dialog } = useConfirm()
  const [draft, setDraft] = useState<string | null>(null)
  const tr = t.trust
  const setLevel = async (next: 0 | 1) => {
    if (next === 1 && !(await ask(fill(tr.confirmRaise, { kind: kind.kind }), { yes: tr.confirmYes }))) return
    await run(() => onSave(buildTrustPatch(kind.kind, { level: next })))
  }
  const setThreshold = async (value: number | null) => {
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 1000)) return fail(fill(t.errors.range, { min: 1, max: 1000 }))
    const r = await run(() => onSave(buildTrustPatch(kind.kind, { threshold: value })))
    if (r.ok) setDraft(null)
  }
  return (
    <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4" data-trust={kind.kind} data-status={status.state}>
      <div className="min-w-0">
        <p className="font-mono text-sm">{kind.kind}</p>
        <p className="text-xs text-faint">
          {fill(tr.streak, { n: kind.streak, a: kind.approvals })}
          {kind.locked ? ` · ${tr.locked}` : ''}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        {tr.threshold}
        <input
          type="number"
          min={1}
          max={1000}
          value={draft ?? String(kind.threshold)}
          aria-label={`${kind.kind}: ${tr.threshold}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== null && Number(draft) !== kind.threshold && void setThreshold(Number(draft))}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={cn(inputClass, 'w-20 font-mono tabular-nums')}
        />
        {kind.custom ? (
          <button type="button" onClick={() => void setThreshold(null)} className="text-accent-text underline" data-act="reset-threshold">
            {tr.reset}
          </button>
        ) : null}
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{kind.level === 1 ? tr.level1 : tr.level0}</span>
        <Switch on={kind.level === 1} label={`${kind.kind}: ${tr.level}`} busy={status.state === 'saving'} onChange={(v) => void setLevel(v ? 1 : 0)} />
      </div>
      <div className="sm:col-span-3">
        <StatusMark status={status} />
      </div>
      {dialog}
    </li>
  )
}

function Usage({ spent, limit, label }: { spent: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  return (
    <span className="mt-1 block text-xs text-muted" data-usage>
      {label}
      {limit > 0 ? (
        <span className="mt-1 block h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-field" role="presentation">
          <span className={cn('block h-full rounded-full', spent >= limit * 0.8 ? 'bg-danger' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </span>
      ) : null}
    </span>
  )
}

export function SettingsSection() {
  const list = useHqView('settings', normalizeSettings, { visible: 60_000, hidden: 300_000 })
  const logList = useHqView('settings/log?limit=200', normalizeLog, { visible: 60_000, hidden: 300_000 })
  const journal = logList.view ?? []
  const reloadLog = logList.reload
  const view = list.view
  const { mutate } = list

  const save: Save = useCallback(
    async (patch) => {
      const r = await hqPatch<Record<string, unknown>>('settings', patch)
      if (!r.ok) {
        const raw = (r as unknown as { fields?: unknown }).fields
        const fields = Array.isArray(raw) ? ` (${raw.slice(0, 4).join(', ')})` : ''
        return { ok: false, error: `${(t.errors as Record<string, string>)[r.error] ?? errText(r.error)}${r.error === 'invalid' ? fields : ''}` }
      }
      const next = normalizeSettings(r)
      if (!next) return { ok: false, error: errText('hq_bad_response') }
      mutate(() => next)
      void reloadLog()
      return { ok: true }
    },
    [mutate, reloadLog],
  )

  return (
    <div className="flex min-h-full flex-col" data-section-view="settings">
      <div className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:px-5">
        <h1 className="font-brand text-xl">Settings</h1>
        <p className="text-sm text-muted">{admin.hq.sectionHints.settings}</p>
      </div>
      {!view ? (
        list.error ? <Offline error={list.error} onRetry={() => list.reload()} /> : <Loading rows={4} />
      ) : (
        <div className="mx-auto grid w-full max-w-4xl gap-3 p-3 sm:p-5">
          {view.restartRequired ? (
            <div role="status" className="rounded-card border border-danger/50 bg-surface p-3 text-sm" data-restart>
              <p className="font-medium">{t.restartTitle}</p>
              <p className="text-muted">{fill(t.restartText, { keys: view.restartKeys.join(', ') })}</p>
            </div>
          ) : null}
          <Autopilot mode={view.settings.autopilot.leadManager} onSave={save} />
          {GROUP_ORDER.slice(0, 3).map((g) => (
            <Card key={g} id={g} title={t.groups[g].title} hint={t.groups[g].hint}>
              {FIELD_GROUPS[g].map((spec) => (
                <Row key={spec.path} spec={spec} settings={view.settings} onSave={save} disabled={spec.path.startsWith('schedule.quietHours.') && spec.path !== 'schedule.quietHours.enabled' && view.settings.schedule.quietHours === null} />
              ))}
            </Card>
          ))}
          <Card id="trust" title={t.groups.trust.title} hint={t.groups.trust.hint}>
            <Row spec={{ path: 'trust.defaultThreshold', kind: 'int', min: 1, max: 1000 }} label={t.trust.default} settings={view.settings} onSave={save} />
            {view.settings.trust.kinds.length ? (
              <ul className="divide-y divide-line">
                {view.settings.trust.kinds.map((k) => (
                  <TrustRow key={k.kind} kind={k} onSave={save} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-sm text-muted">{t.trust.none}</p>
            )}
          </Card>
          {GROUP_ORDER.slice(3).map((g) => (
            <Card key={g} id={g} title={t.groups[g].title} hint={t.groups[g].hint}>
              {FIELD_GROUPS[g].map((spec) => {
                const dept = spec.path.startsWith('limits.deptBudgetUsd.') ? spec.path.split('.')[2]! : null
                const extra = dept ? (
                  <Usage spent={view.usage.deptMonthUsd[dept] ?? 0} limit={view.settings.limits.deptBudgetUsd[dept] ?? 0} label={fill(t.spentOf, { spent: usd(view.usage.deptMonthUsd[dept] ?? 0) })} />
                ) : spec.path === 'limits.clientLlmDailyCap' ? (
                  <Usage spent={view.usage.clientLlmToday} limit={view.settings.limits.clientLlmDailyCap} label={fill(t.spentToday, { n: view.usage.clientLlmToday })} />
                ) : null
                return <Row key={spec.path} spec={spec} settings={view.settings} onSave={save} extra={extra} />
              })}
            </Card>
          ))}
          <section className="rounded-card border border-line bg-surface p-4" data-group="journal">
            <h2 className="text-sm font-medium">{t.journal.title}</h2>
            <p className="mt-0.5 text-xs text-muted">{t.journal.hint}</p>
            {logList.error && !logList.view ? (
              <p className="mt-2 text-sm text-danger" role="alert" data-journal-error>
                {t.journal.failed}{' '}
                <button type="button" className="underline" onClick={() => void reloadLog()}>
                  {t.journal.retry}
                </button>
              </p>
            ) : !logList.view ? (
              <p className="mt-2 text-sm text-muted">{t.journal.loading}</p>
            ) : journal.length ? (
              <ul className="mt-2 grid gap-1 font-mono text-xs" data-journal>
                {journal.map((c, i) => (
                  <li key={`${c.at}-${c.key}-${i}`} className="break-words">
                    <span className="text-faint">{stamp(c.at)}</span> {c.key}: {c.old || '(none)'} {'->'} {c.next || '(none)'}
                    {c.source !== 'owner' ? <span className="text-faint"> ({c.source})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t.journal.empty}</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
