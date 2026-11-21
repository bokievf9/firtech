'use client'

import { EnvelopeSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import { admin } from '@/content/admin'
import { normalizeCabinetDocs, problemLabel, relativeDate, type CabinetDoc } from '@/lib/admin-crm-hq'
import { btn, useHub } from '@/components/admin/hub/ui'
import { errText, fill, hq } from './api'
import { useFeed } from './crm-hq-data'
import { FeedBody, Pill } from './crm-hq-ui'

const k = admin.crm.hq.cabinetDocs

// P-07: the documents the client got in the cabinet whose letter did not go out or that have no PDF
// (`GET /admin/crm/cabinet-docs?problem=1`), each with «письмо не ушло» / «нет PDF» and «Отправить снова»
// (`POST crm/cabinet-docs/:id {action:'resend'}`). Nothing is shown when everything is fine.
export function CabinetDocsBlock({ now }: { now: number }) {
  const { notify } = useHub()
  const feed = useFeed('crm/cabinet-docs?problem=1&limit=100', normalizeCabinetDocs)
  const [busy, setBusy] = useState<number | null>(null)

  const resend = async (d: CabinetDoc) => {
    setBusy(d.id)
    const res = await hq<{ mail?: unknown }>(`crm/cabinet-docs/${d.id}`, { action: 'resend' })
    setBusy(null)
    if (res.ok) {
      notify(k.resent)
      feed.reload()
    } else {
      notify(fill(k.failed, { e: errText(res.error) }), 'error')
      // A refused resend keeps the mark and may have counted an attempt.
      feed.reload()
    }
  }

  return (
    <section aria-label={k.title} className="grid gap-2 rounded-xl border border-line p-3" data-cabinet-docs-problems>
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <EnvelopeSimple size={16} aria-hidden="true" /> {k.title}
      </h3>
      <p className="text-xs text-faint">{k.hint}</p>
      <FeedBody feed={feed}>
        {(list) =>
          list.items.length ? (
            <ul className="grid gap-1.5">
              {list.items.map((d) => (
                <li key={d.id} className="rounded-xl bg-inset px-3 py-2" data-cabinet-doc={d.id}>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {(k.kinds as Record<string, string>)[d.kind] ?? d.kind}
                      {d.number ? ` ${fill(k.number, { n: d.number })}` : ''}
                      {d.title ? `: ${d.title}` : ''}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {d.problems.map((code) => (
                        <Pill key={code} tone="warn">
                          {problemLabel(code)}
                        </Pill>
                      ))}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {[
                      d.client,
                      d.mail.state ? (k.mail as Record<string, string>)[d.mail.state] : '',
                      d.mail.attempts ? fill(k.attempts, { n: d.mail.attempts }) : '',
                      relativeDate(d.createdAt, now),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {d.actions.includes('resend') ? (
                    <button type="button" className={`${btn} mt-2 min-h-9`} disabled={busy !== null} onClick={() => void resend(d)} data-resend={d.id}>
                      {busy === d.id ? k.resending : k.resend}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted" data-cabinet-docs-ok>
              {k.empty}
            </p>
          )
        }
      </FeedBody>
    </section>
  )
}
