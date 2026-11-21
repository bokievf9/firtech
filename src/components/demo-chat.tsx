'use client'

import { PaperPlaneRight } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Dict } from '@/content'
import { DEMO_TEXT_MAX, newConversationId, parseDemoAnswer, type DemoLimit } from '@/lib/demo-chat'
import { buttonStyles, cn } from '@/lib/cn'
import { inputClass } from '@/components/cabinet/ui'

type Msg = { from: 'you' | 'agent'; text: string }

// The demo chat of a lead's draft agent (`/<locale>/demo/<publicId>?k=`). Needs no sign-in. Each message goes to
// HQ's public `POST /agent/<publicId>/chat` with the key from the link as `demoKey`; the demo's message limit is shown
// from HQ's answer (and the daily limit sentence when HQ answers 429).
export function DemoChat({ dict, publicId, demoKey }: { dict: Dict; publicId: string; demoKey: string }) {
  const t = dict.demoPage
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState<DemoLimit>({ limit: null, remaining: null })
  const [closed, setClosed] = useState(false)
  const conversation = useRef<string>('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    conversation.current = newConversationId()
  }, [])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, busy])

  async function send() {
    const value = text.trim()
    if (!value || busy || closed) return
    setText('')
    setError('')
    setBusy(true)
    setMessages((m) => [...m, { from: 'you', text: value }])
    try {
      const res = await fetch(`/agent/${encodeURIComponent(publicId)}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ demoKey, text: value, conversationId: conversation.current }),
      })
      const answer = parseDemoAnswer(res.status, await res.json().catch(() => null))
      if (answer.ok) {
        setMessages((m) => [...m, { from: 'agent', text: answer.reply }])
        setLimit(answer.limit)
        if (answer.limit.remaining === 0) setClosed(true)
      } else {
        if (answer.error === 'limit_reached') setClosed(true)
        setError((t.errors as Record<string, string>)[answer.error] ?? t.errors.unavailable)
      }
    } catch {
      setError(t.errors.network)
    }
    setBusy(false)
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface" data-demo-chat>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-[13px] text-faint">
        <span>{t.badge}</span>
        {limit.limit !== null && limit.remaining !== null && (
          <span data-demo-limit className="font-mono">
            {t.left.replace('{n}', String(limit.remaining)).replace('{max}', String(limit.limit))}
          </span>
        )}
      </div>
      <div className="grid h-[min(60dvh,520px)] min-h-[320px] content-start gap-3 overflow-y-auto p-4" aria-live="polite" aria-label={t.log}>
        {messages.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}
        {messages.map((m, i) => (
          <p
            key={i}
            data-demo-msg={m.from}
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap',
              m.from === 'you' ? 'justify-self-end bg-accent text-accent-ink' : 'justify-self-start bg-surface-2 text-fg',
            )}
          >
            {m.text}
          </p>
        ))}
        {busy && <p className="justify-self-start text-sm text-faint">{t.typing}</p>}
        <div ref={end} />
      </div>
      {error && (
        <p role="alert" className="border-t border-line px-4 py-3 text-[13px] text-danger" data-demo-error>
          {error}
        </p>
      )}
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={DEMO_TEXT_MAX}
          disabled={closed}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className={inputClass}
        />
        <button type="submit" disabled={busy || closed || !text.trim()} className={cn(buttonStyles.primary, '!px-4')} aria-label={t.send}>
          <PaperPlaneRight size={20} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
