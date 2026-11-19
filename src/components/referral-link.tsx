'use client'

import { Check, Copy } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import type { Dict } from '@/content'
import { buttonStyles, cn } from '@/lib/cn'
import { refLink, sanitizeRefSlug } from '@/lib/referral'
import { track } from '@/lib/analytics'

// Referral link generator: a name or @username becomes `<site>/<locale>?ref=<slug>`. No backend.
export function ReferralLink({
  dict,
  locale,
  origin,
}: {
  dict: Dict
  locale: string
  origin: string
}) {
  const t = dict.referral
  const id = useId()
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)
  const slug = sanitizeRefSlug(value)
  const link = slug ? refLink(origin, locale, slug) : ''

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      track('cta_click', { place: 'referral_copy' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the link stays selectable in the field.
    }
  }

  return (
    <div className="rounded-card border border-line p-6 md:p-8">
      <h2 className="font-display text-2xl font-semibold md:text-3xl">{t.generatorTitle}</h2>
      <p className="mt-3 max-w-[56ch] text-muted">{t.generatorText}</p>
      <label htmlFor={id} className="mt-6 block text-sm text-faint">
        {t.inputLabel}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setCopied(false)
        }}
        placeholder={t.inputPlaceholder}
        maxLength={64}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="ym-disable-keys mt-2 w-full rounded-2xl border border-line-strong bg-transparent px-4 py-3 text-base outline-none transition-colors focus:border-accent"
      />
      <p className="mt-2 text-[13px] text-faint">{t.hint}</p>
      <p className="mt-6 text-sm text-faint">{t.linkLabel}</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
        <output
          aria-live="polite"
          className={cn(
            'min-w-0 flex-1 rounded-2xl border border-line px-4 py-3 font-mono text-sm break-all',
            link ? 'text-fg' : 'text-faint',
          )}
        >
          {link || t.empty}
        </output>
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className={cn(buttonStyles.primary, 'shrink-0')}
        >
          {copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </div>
  )
}
