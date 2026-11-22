'use client'

import { ArrowCounterClockwise, WarningCircle } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fill } from '@/components/admin/control/api'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'
import { stageDefs, stageTemplateIds, type Pricing, type StageTemplateId } from '@/lib/pricing'
import { getAt, groupTitles, type HistoryEntry, type PriceField, type PriceGroup, type PriceUnit } from '@/lib/pricing-types'
import { productPrices } from '@/lib/products'
import { Chip, shortTime } from './bits'
import { Empty, Loading, Offline, useConfirm, useHub } from '../hub/ui'

const k = admin.pult.prices

// What GET and POST /api/admin/prices return (src/lib/pricing-edit.ts `editorView`).
type View = {
  defaults: Pricing
  merged: Pricing
  overridden: string[]
  updatedAt: string | null
  history: HistoryEntry[]
  fields: PriceField[]
  stages: Record<string, { name: string; ids: string[] }>
}
type Op = { path: string; value: number } | { reset: string }

const fmt = (unit: PriceUnit, value: number) =>
  unit === 'percent' ? `${value}%` : unit === 'usd_month' ? `$${value.toLocaleString('en-US')}${k.perMonth}` : `$${value.toLocaleString('en-US')}`

const errorText = (key: string) => (k.errors as Record<string, string>)[key.split(':')[0] ?? ''] ?? key

// The editor's own state: one GET, then every edit goes optimistic and the server's answer replaces
// the copy; a refusal rolls back and says why.
function usePrices(notify: (text: string, tone?: 'info' | 'error') => void) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  const load = useCallback(async () => {
    const mine = generation.current
    try {
      const res = await fetch('/api/admin/prices', { cache: 'no-store' })
      const body = (await res.json()) as { ok?: boolean; error?: string } & Partial<View>
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
      if (mine === generation.current) {
        setView(body as View)
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network')
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => void load(), 0)
    return () => clearTimeout(id)
  }, [load])

  // `local` is the optimistic merged pricing; `done` is the toast on success.
  const send = useCallback(
    async (payload: unknown, local: (v: View) => View, done: (changed: number) => string) => {
      const before = view
      generation.current++
      if (view) setView(local(view))
      try {
        const res = await fetch('/api/admin/prices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        const body = (await res.json()) as { ok?: boolean; error?: string; changed?: number } & Partial<View>
        if (!res.ok || !body.ok) throw new Error(body.error ?? 'network')
        setView(body as View)
        notify(done(body.changed ?? 0))
        return true
      } catch (e) {
        setView(before)
        notify(fill(k.failed, { e: errorText(e instanceof Error ? e.message : 'network') }), 'error')
        return false
      }
    },
    [view, notify],
  )
  return { view, error, load, send }
}

// Sets one number inside a pricing copy by its dotted path.
function withValue(p: Pricing, path: string, value: number): Pricing {
  const next = structuredClone(p) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let node = next
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>
  node[keys[keys.length - 1] as string] = value
  return next as unknown as Pricing
}

function applyLocal(v: View, ops: Op[]): View {
  let merged = v.merged
  const over = new Set(v.overridden)
  for (const op of ops) {
    if ('reset' in op) {
      for (const f of v.fields)
        if (op.reset === 'all' || f.path === op.reset) {
          merged = withValue(merged, f.path, f.def)
          over.delete(f.path)
        }
    } else {
      merged = withValue(merged, op.path, op.value)
      const def = getAt(v.defaults, op.path)
      if (def === op.value) over.delete(op.path)
      else over.add(op.path)
    }
  }
  return { ...v, merged, overridden: [...over] }
}

// A number you click to edit: Enter saves, Escape or leaving the field cancels.
function PriceCell({ field, value, overridden, onSave, onReset }: { field: PriceField; value: number; overridden: boolean; onSave: (v: number) => void; onReset: () => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (draft !== null) ref.current?.select()
    // Select once when the input opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null])
  const n = draft === null ? NaN : Number(draft)
  const bad = draft !== null && (draft.trim() === '' || !Number.isInteger(n) || n < field.min || n > field.max)
  const commit = () => {
    if (draft === null) return
    if (bad) return
    setDraft(null)
    if (n !== value) onSave(n)
  }
  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      {overridden ? (
        <span className="hidden min-w-0 items-center gap-1 text-xs text-faint sm:flex">
          <span className="truncate">{fill(k.defaultHint, { n: fmt(field.unit, field.def) })}</span>
        </span>
      ) : null}
      {overridden ? (
        <button type="button" onClick={onReset} title={k.reset} aria-label={fill(k.resetFor, { t: field.label })} className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong text-muted hover:border-accent hover:text-accent-text">
          <ArrowCounterClockwise size={14} aria-hidden="true" />
        </button>
      ) : null}
      {draft === null ? (
        <button
          type="button"
          onClick={() => setDraft(String(value))}
          aria-label={`${fill(k.editFor, { t: field.label })}: ${fmt(field.unit, value)}`}
          className={cn('min-h-9 min-w-[5.5rem] rounded-lg border px-3 text-right font-mono text-sm tabular-nums hover:border-accent', overridden ? 'border-accent/60 bg-surface text-accent-text' : 'border-line-strong bg-surface')}
        >
          {fmt(field.unit, value)}
        </button>
      ) : (
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoFocus
          value={draft}
          aria-label={fill(k.inputFor, { t: field.label })}
          aria-invalid={bad}
          title={fill(k.limits, { min: fmt(field.unit, field.min), max: fmt(field.unit, field.max) })}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setDraft(null)
            }
          }}
          onBlur={() => setDraft(null)}
          className={cn('h-9 w-24 rounded-lg border bg-field px-3 text-right font-mono text-sm tabular-nums outline-none focus:border-accent', bad ? 'border-danger' : 'border-line-strong')}
        />
      )}
    </div>
  )
}

function Row({ field, view, onSave, onReset }: { field: PriceField; view: View; onSave: (f: PriceField, v: number) => void; onReset: (f: PriceField) => void }) {
  const value = getAt(view.merged, field.path) as number
  const overridden = view.overridden.includes(field.path)
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-line bg-inset px-3 py-1.5">
      <span className="min-w-0 flex-[1_1_9rem] text-sm">{field.label}</span>
      <div className="flex min-w-0 flex-col items-end gap-0.5">
        <PriceCell field={field} value={value} overridden={overridden} onSave={(v) => onSave(field, v)} onReset={() => onReset(field)} />
        {overridden ? <span className="text-xs text-faint sm:hidden">{fill(k.defaultHint, { n: fmt(field.unit, field.def) })}</span> : null}
      </div>
    </li>
  )
}

// One payment-stage template: every share at once, the sum must be exactly 100 before it saves.
function StageEditor({ id, name, view, onSave, onReset }: { id: StageTemplateId; name: string; view: View; onSave: (ops: Op[]) => void; onReset: (ops: Op[]) => void }) {
  const defs = stageDefs(id, view.merged)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const shown = (stageId: string, share: number) => draft?.[stageId] ?? String(share)
  const values = defs.map((s) => Number(shown(s.id, s.share)))
  const sum = values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
  const valid = values.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) && sum === 100
  const changed = draft !== null && defs.some((s) => Number(draft[s.id] ?? s.share) !== s.share)
  const overridden = defs.some((s) => view.overridden.includes(`stageShares.${id}.${s.id}`))
  const save = () => {
    if (!valid || !changed) return
    onSave(defs.map((s, i) => ({ path: `stageShares.${id}.${s.id}`, value: values[i] as number })))
    setDraft(null)
  }
  return (
    <li className="grid gap-2 rounded-xl border border-line bg-inset p-3" data-stage-template={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{name}</span>
        <span className="flex items-center gap-2">
          {overridden ? <Chip tone="accent">{k.overridden}</Chip> : null}
          <span role="status" className={cn('inline-flex items-center gap-1 text-xs tabular-nums', sum === 100 ? 'text-muted' : 'font-medium text-danger')}>
            {sum === 100 ? null : <WarningCircle size={14} aria-hidden="true" />}
            {fill(sum === 100 ? k.stageSum : k.stageSumBad, { n: sum })}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {defs.map((s) => {
          const base = view.defaults.stageShares[id][s.id]
          return (
            <label key={s.id} className="grid gap-1 text-xs text-muted">
              <span className="leading-tight">{s.title.ru}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={shown(s.id, s.share)}
                  aria-label={fill(k.stageInput, { t: `${name}: ${s.title.ru}` })}
                  onChange={(e) => setDraft({ ...(draft ?? Object.fromEntries(defs.map((d) => [d.id, String(d.share)]))), [s.id]: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      save()
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setDraft(null)
                    }
                  }}
                  className={cn('h-9 w-20 rounded-lg border bg-field px-3 text-right font-mono text-sm text-fg tabular-nums outline-none focus:border-accent', sum === 100 ? 'border-line-strong' : 'border-danger')}
                />
                <span aria-hidden="true">%</span>
                {s.share !== base ? <span className="text-faint">{fill(k.defaultHint, { n: `${base}%` })}</span> : null}
              </span>
            </label>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {changed ? (
          <button type="button" onClick={save} disabled={!valid} className="inline-flex min-h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-40">
            {k.stageSave}
          </button>
        ) : null}
        {overridden ? (
          <button type="button" onClick={() => onReset(defs.map((s) => ({ reset: `stageShares.${id}.${s.id}` })))} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm text-muted hover:border-accent hover:text-accent-text">
            <ArrowCounterClockwise size={14} aria-hidden="true" /> {k.stageReset}
          </button>
        ) : null}
      </div>
    </li>
  )
}

// «Бот-администратор от $X · Сайт от $Y · Этапы сайта 30/40/30», recomputed from the pricing as edited.
function Preview({ pricing }: { pricing: Pricing }) {
  const prices = useMemo(() => productPrices(pricing), [pricing])
  const bot = prices.admin
  const shares = stageDefs('site', pricing).map((s) => s.share).join('/')
  const items = [
    bot.kind === 'from' ? fill(k.previewBot, { usd: `$${bot.from.toLocaleString('en-US')}` }) : null,
    fill(k.previewSite, { usd: `$${pricing.startingPrice.websites.toLocaleString('en-US')}` }),
    fill(k.previewStages, { shares }),
  ].filter((v): v is string => v !== null)
  return (
    <div className="grid gap-1 rounded-card border border-accent/40 bg-surface p-3" data-prices-preview>
      <p className="text-xs text-faint">{k.previewLabel}</p>
      <p className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-sm">
        {items.map((t, i) => (
          <span key={t} className="whitespace-nowrap">
            {i > 0 ? <span aria-hidden="true" className="mr-2 text-faint">·</span> : null}
            {t}
          </span>
        ))}
      </p>
    </div>
  )
}

const order: PriceGroup[] = ['start', 'kinds', 'options', 'extras', 'plans', 'discounts', 'stages']

// «Цены» tab of the Компания panel: every price of the site, edited in place (Enter saves, Esc
// cancels), with the default shown next to a changed one, a reset for all, and the history.
export function PricesTab() {
  const { notify } = useHub()
  const { view, error, load, send } = usePrices(notify)
  const { ask, dialog } = useConfirm()
  const [more, setMore] = useState(false)

  const save = (f: PriceField, value: number) =>
    void send({ path: f.path, value }, (v) => applyLocal(v, [{ path: f.path, value }]), () => fill(k.saved, { t: f.label, v: fmt(f.unit, value) }))
  const reset = (f: PriceField) => void send({ ops: [{ reset: f.path }] }, (v) => applyLocal(v, [{ reset: f.path }]), () => fill(k.resetDone, { t: f.label }))
  const saveMany = (ops: Op[]) => void send({ ops }, (v) => applyLocal(v, ops), (n) => fill(k.savedMany, { n }))
  const resetMany = (ops: Op[]) => void send({ ops }, (v) => applyLocal(v, ops), () => k.stageResetDone)

  const resetAll = async () => {
    if (!view?.overridden.length) return notify(k.resetAllNothing)
    if (!(await ask(k.resetAllConfirm, { yes: k.resetAllYes, danger: true }))) return
    void send({ action: 'reset' }, (v) => applyLocal(v, [{ reset: 'all' }]), (n) => fill(k.savedMany, { n }))
  }

  if (!view) return error ? <Offline error={errorText(error)} onRetry={() => void load()} /> : <Loading rows={4} />

  const labelOf = (path: string) => view.fields.find((f) => f.path === path)
  const sections = (group: PriceGroup) => {
    const out: { name: string; fields: PriceField[] }[] = []
    for (const f of view.fields.filter((x) => x.group === group && !x.path.startsWith('stageShares.'))) {
      const last = out[out.length - 1]
      if (last && last.name === f.section) last.fields.push(f)
      else out.push({ name: f.section, fields: [f] })
    }
    return out
  }
  const history = more ? view.history : view.history.slice(0, 8)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-[1_1_20rem] text-xs leading-relaxed text-muted">{k.intro}</p>
        <button type="button" onClick={() => void resetAll()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-danger/50 px-4 text-sm text-danger hover:bg-danger/10">
          <ArrowCounterClockwise size={14} aria-hidden="true" /> {k.resetAll}
        </button>
      </div>
      <Preview pricing={view.merged} />
      {order.map((group) => {
        const list = sections(group)
        return (
          <section key={group} className="grid gap-2" data-prices-group={group}>
            <h3 className="text-sm font-medium">{groupTitles[group]}</h3>
            {group === 'extras' ? <p className="text-xs text-faint">{k.linkedNote}</p> : null}
            {group === 'stages' ? <p className="text-xs text-faint">{k.stagesNote}</p> : null}
            {list.map((s, si) => (
              <div key={`${s.name}:${si}`} className="grid gap-1">
                {s.name !== groupTitles[group] && list.length > 1 ? <h4 className="text-xs text-muted">{s.name}</h4> : null}
                <ul className="grid gap-1">
                  {s.fields.map((f) => (
                    <Row key={f.path} field={f} view={view} onSave={save} onReset={reset} />
                  ))}
                </ul>
              </div>
            ))}
            {group === 'stages' ? (
              <ul className="grid gap-2">
                {stageTemplateIds.map((id) => (
                  <StageEditor key={`${id}:${JSON.stringify(view.merged.stageShares[id])}`} id={id} name={view.stages[id]?.name ?? id} view={view} onSave={saveMany} onReset={resetMany} />
                ))}
              </ul>
            ) : null}
          </section>
        )
      })}
      <section className="grid gap-2" data-prices-history>
        <h3 className="text-sm font-medium">{k.history}</h3>
        <p className="text-xs text-faint">{view.updatedAt ? fill(k.updated, { t: shortTime(view.updatedAt) }) : k.neverUpdated}. {k.hqNote}</p>
        {history.length ? (
          <ul className="grid gap-1">
            {history.map((h, i) => {
              const f = labelOf(h.path)
              const unit = f?.unit ?? 'usd'
              return (
                <li key={`${h.at}:${h.path}:${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-line bg-inset px-3 py-1.5 text-xs">
                  <span className="text-faint tabular-nums">{shortTime(h.at)}</span>
                  <span className="min-w-0 flex-1 basis-40">{f ? `${f.section}: ${f.label}` : h.path}</span>
                  <span className="font-mono tabular-nums">{fmt(unit, h.from)} → {fmt(unit, h.to)}</span>
                  <span className="text-faint">{(k.who as Record<string, string>)[h.by] ?? h.by}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>{k.historyEmpty}</Empty>
        )}
        {!more && view.history.length > 8 ? (
          <button type="button" onClick={() => setMore(true)} className="justify-self-start text-xs text-muted underline underline-offset-4 hover:text-fg">
            {k.historyMore}
          </button>
        ) : null}
      </section>
      {dialog}
    </div>
  )
}
