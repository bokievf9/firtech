'use client'

import { Siren } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import type { HqDepartment } from '@/lib/hq-admin-view'
import { errText, hq } from './api'
import { CcPanel } from './cc-panel'

const t = admin.cc.drill
const deptName = (d: HqDepartment) => (admin.office.depts as Record<string, string>)[d.id] ?? d.title
const FOLLOW_MS = 3000
const FOLLOW_FOR_MS = 60_000

// «Учения»: same as /drill in the bot. Run sends POST /drill { arg: dept }, «Таблица» reads
// GET /drill, «Очистить» sends { arg: 'clear' }. After a run the table refreshes every 3 s for a minute.
export function DrillPanel({ departments, className }: { departments: HqDepartment[]; className?: string }) {
  const [dept, setDept] = useState('')
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [followUntil, setFollowUntil] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = (res: { ok: true; text?: unknown } | { ok: false; error: string }) => {
    if (res.ok) {
      setText(typeof res.text === 'string' ? res.text : '')
      setError(null)
    } else setError(res.error)
  }

  const run = async (kind: 'run' | 'table' | 'clear') => {
    setBusy(true)
    const res =
      kind === 'table'
        ? await hq<{ text: string }>('drill')
        : await hq<{ text: string }>('drill', { arg: kind === 'clear' ? 'clear' : dept })
    setBusy(false)
    show(res)
    setFollowUntil(kind === 'run' && res.ok ? Date.now() + FOLLOW_FOR_MS : 0)
  }

  useEffect(() => {
    if (!followUntil) return
    const tick = async () => {
      if (Date.now() > followUntil) {
        setFollowUntil(0)
        return
      }
      if (!document.hidden) show(await hq<{ text: string }>('drill'))
      timer.current = setTimeout(tick, FOLLOW_MS)
    }
    timer.current = setTimeout(tick, FOLLOW_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [followUntil])

  return (
    <CcPanel id="drill" title={t.title} icon={<Siren size={18} aria-hidden="true" />} className={className}>
      <div className="grid gap-3 p-4">
        <p className="text-xs text-muted">{t.lead}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-40 flex-1 gap-1 text-xs text-muted">
            {t.dept}
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="min-h-11 rounded-xl border border-line-strong bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
            >
              <option value="">{t.all}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {deptName(d)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('run')}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {t.run}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('table')}
            className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-sm disabled:opacity-50"
          >
            {t.table}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run('clear')}
            className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-muted hover:text-fg disabled:opacity-50"
          >
            {t.clear}
          </button>
        </div>
        {error ? <p className="text-sm text-danger">{errText(error)}</p> : null}
        <pre
          aria-live="polite"
          className="min-h-24 overflow-x-auto rounded-xl bg-bg/70 p-3 font-mono text-xs leading-relaxed whitespace-pre"
        >
          {text ?? <span className="text-faint">{t.empty}</span>}
        </pre>
        {followUntil ? <p className="text-xs text-faint">{t.running}</p> : null}
      </div>
    </CcPanel>
  )
}
