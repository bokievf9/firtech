'use client'

import { Star } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Dict } from '@/content'
import { REVIEW_TEXT_MAX } from '@/lib/cabinet-review'
import { buttonStyles, cn } from '@/lib/cn'
import { CopyLink } from './cabinet-forms'
import { FormMessage, inputClass } from './ui'

// The review form of a finished project (`?review=<projectId>`, the link of HQ's «Как вам работа с Fir Tech?»
// email): a rating 1..5 and a text go to `POST /api/cabinet/reviews`. After sending: thanks and the client's
// referral link. A second review is refused by HQ (409 `exists`), shown as a sentence.
export function ReviewCard({
  dict,
  projectId,
  refLink,
  thanksSub,
}: {
  dict: Dict
  projectId: number
  refLink: string | null
  // The thank-you sentence with the referral percent already filled in (server side, live pricing).
  thanksSub: string
}) {
  const t = dict.cabinet.v3.review
  const errors = t.errors as Record<string, string>
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function send() {
    if (rating < 1 || !text.trim()) {
      setError(errors.invalid ?? '')
      return
    }
    setError('')
    setStatus('sending')
    try {
      const res = await fetch('/api/cabinet/reviews', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId, rating, text }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (res.ok && body?.ok) {
        setStatus('done')
        return
      }
      const code = body?.error ?? ''
      setError(errors[code] ?? errors.hq ?? '')
    } catch {
      setError(errors.network ?? '')
    }
    setStatus('idle')
  }

  if (status === 'done') {
    return (
      <section className="rounded-card border border-accent-text/40 bg-surface p-6 md:p-8" data-review-done aria-live="polite">
        <h2 className="font-display text-xl font-semibold tracking-tight">{t.thanks}</h2>
        <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted">{thanksSub}</p>
        {refLink && (
          <div className="mt-4 grid gap-2">
            <p className="text-sm font-medium">{t.refLabel}</p>
            <CopyLink link={refLink} dict={dict} />
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-card border border-accent-text/40 bg-surface p-6 md:p-8" data-review-form aria-labelledby="cabinet-review-title">
      <h2 id="cabinet-review-title" className="font-display text-xl font-semibold tracking-tight">
        {t.title}
      </h2>
      <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted">{t.sub}</p>
      <form
        className="mt-5 grid max-w-xl gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="text-sm text-muted">{t.rating}</legend>
          <div className="flex gap-1" role="radiogroup" aria-label={t.rating}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={t.star.replace('{n}', String(n))}
                data-rating={n}
                onClick={() => setRating(n)}
                className="rounded-md p-1 text-faint transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-accent-text"
              >
                <Star size={32} weight={n <= rating ? 'fill' : 'regular'} aria-hidden="true" className={cn(n <= rating && 'text-accent-text')} />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <label htmlFor="review-text" className="text-sm text-muted">
            {t.text}
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={REVIEW_TEXT_MAX}
            className={inputClass}
          />
          <p className="text-[13px] text-faint">{t.textHelp}</p>
        </div>
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <button type="submit" disabled={status === 'sending'} className={cn(buttonStyles.primary, 'justify-self-start')}>
          {status === 'sending' ? t.sending : t.submit}
        </button>
      </form>
    </section>
  )
}
