'use client'

import { FileText, UploadSimple } from '@phosphor-icons/react'
import { useEffect, useId, useState, type DragEvent } from 'react'
import type { Dict } from '@/content'
import {
  checkUpload,
  formatSize,
  materialFiles,
  materialLabels,
  mergeMessages,
  parseMessageItem,
  parseMessages,
  uploadAccept,
  type ChatMessage,
  type ChatThread,
  type MaterialLabel,
} from '@/lib/cabinet-chat'
import { formatDate } from '@/lib/cabinet-data'
import { Card } from '@/components/ui'
import { buttonStyles, cn } from '@/lib/cn'
import { Chip, Empty, FormMessage, fill } from './ui'

// «Материалы» (cabinet v3): the client uploads a logo, texts, photos or access details with a label.
// The file goes through /api/cabinet/uploads into the project thread (else the request's thread), so
// the team sees it in the conversation; the list below is that thread's own uploads.
export function MaterialsPanel({ dict, locale, thread }: { dict: Dict; locale: string; thread: ChatThread | null }) {
  const t = dict.cabinet.v3.materials
  const errors = t.errors as Record<string, string>
  const uid = useId()
  const [label, setLabel] = useState<MaterialLabel>('logo')
  const [file, setFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const threadId = thread?.id ?? null

  useEffect(() => {
    if (!threadId) return
    let alive = true
    fetch(`/api/cabinet/threads/${encodeURIComponent(threadId)}/messages`, { cache: 'no-store' })
      .then((res) => res.json().then((body: { ok?: boolean; messages?: unknown } | null) => (res.ok && body?.ok ? parseMessages(body.messages) : null)))
      .then((rows) => {
        if (alive && rows) setMessages(rows)
      })
      .catch(() => {
        // The list stays empty; uploading still works.
      })
    return () => {
      alive = false
    }
  }, [threadId])

  function choose(f: File | undefined) {
    if (!f) return
    const checked = checkUpload(f)
    if (!checked.ok) {
      setError(errors[checked.error] ?? '')
      return
    }
    setError('')
    setState('idle')
    setFile(f)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setOver(false)
    choose(e.dataTransfer.files?.[0])
  }

  async function upload() {
    if (!file || !threadId) {
      setError(errors.invalid ?? '')
      return
    }
    setState('sending')
    setError('')
    const form = new FormData()
    form.set('file', file, file.name)
    form.set('threadId', threadId)
    form.set('label', label)
    try {
      const res = await fetch('/api/cabinet/uploads', { method: 'POST', body: form })
      const data = (await res.json().catch(() => null)) as { ok?: boolean; item?: unknown; error?: string } | null
      const item = res.ok && data?.ok ? parseMessageItem({ item: data.item }) : null
      if (item) {
        setMessages((m) => mergeMessages(m, [item]))
        setFile(null)
        setState('done')
        return
      }
      setError(errors[data?.error ?? ''] ?? errors.hq ?? '')
    } catch {
      setError(errors.network ?? '')
    }
    setState('idle')
  }

  const files = materialFiles(messages)

  return (
    <section aria-labelledby="cabinet-materials-title" data-cabinet-materials>
      <h2 id="cabinet-materials-title" className="font-display text-title-2 font-semibold">
        {t.title}
      </h2>
      <p className="mt-2 max-w-[62ch] text-callout leading-relaxed text-muted">{t.sub}</p>

      {!thread ? (
        <Card className="mt-5 md:p-sheet">
          <Empty>{t.noThread}</Empty>
        </Card>
      ) : (
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Card  data-materials-form>
            <p className="text-footnote text-faint">{fill(t.forProject, { title: thread.title })}</p>
            <fieldset className="mt-4">
              <legend className="text-callout text-muted">{t.label}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {materialLabels.map((l) => (
                  <label
                    key={l}
                    className={cn(
                      'cursor-pointer rounded-full border px-3.5 py-1.5 text-callout transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text',
                      label === l ? 'border-accent-text bg-accent/10 text-fg' : 'border-line-strong text-muted hover:text-fg',
                    )}
                  >
                    <input type="radio" name={`${uid}-label`} checked={label === l} onChange={() => setLabel(l)} className="sr-only" />
                    {t.labels[l]}
                  </label>
                ))}
              </div>
            </fieldset>

            <div
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
              className={cn(
                'mt-5 grid place-items-center gap-3 rounded-tile border border-dashed p-8 text-center transition-colors',
                over ? 'border-accent-text bg-accent/[0.07]' : 'border-line-strong',
              )}
            >
              <UploadSimple size={28} aria-hidden="true" className="text-faint" />
              <p className="max-w-[40ch] text-callout text-muted">{t.drop}</p>
              <input
                id={`${uid}-file`}
                type="file"
                accept={uploadAccept}
                className="sr-only"
                onChange={(e) => {
                  choose(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <label htmlFor={`${uid}-file`} className={cn(buttonStyles.secondary, 'cursor-pointer')}>
                {t.choose}
              </label>
              <p className="text-caption text-faint">{t.formats}</p>
            </div>

            {file && (
              <div className="mt-4 flex items-center gap-3 rounded-tile border border-hairline border-line px-4 py-3 text-callout" data-pending-file>
                <FileText size={20} aria-hidden="true" className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 font-mono text-caption text-faint">{formatSize(file.size)}</span>
              </div>
            )}
            {label === 'access' && <p className="mt-3 text-footnote leading-relaxed text-muted">{t.accessNote}</p>}
            {error && (
              <div className="mt-3">
                <FormMessage kind="error">{error}</FormMessage>
              </div>
            )}
            {state === 'done' && (
              <div className="mt-3">
                <FormMessage kind="ok">{t.uploaded}</FormMessage>
              </div>
            )}
            <button type="button" onClick={() => void upload()} disabled={!file || state === 'sending'} className={cn(buttonStyles.primary, 'mt-5')} data-upload>
              {state === 'sending' ? t.uploading : t.upload}
            </button>
          </Card>

          <Card >
            <h3 className="font-display text-headline font-semibold">{t.listTitle}</h3>
            {files.length === 0 ? (
              <div className="mt-3">
                <Empty>{t.none}</Empty>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2" data-material-list>
                {files.map((f) => (
                  <li key={`${f.messageId}-${f.name}`}>
                    <a
                      {...(f.href ? { href: f.href } : {})}
                      className="flex items-center gap-3 rounded-tile border border-hairline border-line px-3.5 py-2.5 transition-colors hover:border-line-strong"
                    >
                      <FileText size={18} aria-hidden="true" className="shrink-0 text-faint" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-callout">{f.name}</span>
                        <span className="block font-mono text-caption text-faint">
                          {formatDate(f.at, locale)}
                          {f.size > 0 ? `, ${formatSize(f.size)}` : ''}
                        </span>
                      </span>
                      {f.label && <Chip>{(t.labels as Record<string, string>)[f.label] ?? f.label}</Chip>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}
