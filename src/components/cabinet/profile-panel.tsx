'use client'

import { Check, LockSimple } from '@phosphor-icons/react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { ErrorNote } from '@/components/ui/error-note'
import { Spinner } from '@/components/ui/spinner'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { fetchJson, type ErrorInfo } from '@/lib/errors'
import type { NotifyChannel, ProfileField, ProfilePatch, ProfileView } from '@/lib/cabinet-profile'
import type { Locale } from '@/lib/i18n'
import { inputClass } from './ui'
import { ProfileSecurity } from './profile-security'

// The cabinet «Профиль» (owner review 2026-11-22, items 10 and 11): sections Вы, Компания, Для документов,
// Уведомления, Безопасность. Nothing here is a form action (React resets a form after an action and that
// unchecked the newsletter box, see lib/cabinet-profile.ts): a text field saves on blur, a switch or a
// choice saves at once with a rollback on failure. Every answer is the row read back from the database
// and replaces the local state. The newest saved profile is kept in this module so the panel shows it
// again after a tab switch (the page props are from the first render).

export type NicheGroup = { label: string; options: { id: string; name: string }[] }
type Status = { state: 'saving' } | { state: 'saved'; at: number } | { state: 'error'; error: ErrorInfo; retry: () => void }

let latest: ProfileView | null = null
const newer = (a: ProfileView, b: ProfileView | null) => !b || (a.updatedAt ?? '') >= (b.updatedAt ?? '')

function useProfile(initial: ProfileView, locale: Locale) {
  const [profile, setProfile] = useState<ProfileView>(() => (latest && newer(latest, initial) ? latest : initial))
  const [status, setStatus] = useState<Partial<Record<ProfileField, Status>>>({})

  async function save(patch: ProfilePatch, fields: ProfileField[] = Object.keys(patch) as ProfileField[]): Promise<boolean> {
    const mark = (s: Status | undefined) => setStatus((all) => ({ ...all, ...Object.fromEntries(fields.map((f) => [f, s])) }))
    mark({ state: 'saving' })
    const res = await fetchJson<{ ok: true; profile: ProfileView }>('/api/cabinet/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
      locale,
    })
    if (res.ok && res.data.profile) {
      latest = res.data.profile
      setProfile(res.data.profile)
      mark({ state: 'saved', at: Date.now() })
      return true
    }
    const error = res.ok ? { code: 'save_failed', status: 500, message: '', hint: '', retryable: true } : res.error
    mark({ state: 'error', error, retry: () => void save(patch, fields) })
    return false
  }

  return { profile, setProfile, status, save }
}

function FieldStatus({ status, t }: { status?: Status; t: Dict['cabinet']['profile']['status'] }) {
  // «Сохранено» shows for 2.5 s after each save, then fades out of the line.
  const [faded, setFaded] = useState(0)
  const savedAt = status?.state === 'saved' ? status.at : 0
  useEffect(() => {
    if (!savedAt) return
    const id = window.setTimeout(() => setFaded(savedAt), 2500)
    return () => window.clearTimeout(id)
  }, [savedAt])
  const fresh = savedAt !== 0 && faded !== savedAt
  return (
    <span aria-live="polite" className="inline-flex min-h-5 items-center gap-1.5 text-[12px] text-faint">
      {status?.state === 'saving' ? (
        <>
          <Spinner className="size-3" />
          {t.saving}
        </>
      ) : fresh ? (
        <span className="inline-flex items-center gap-1 text-accent-text">
          <Check size={13} weight="bold" aria-hidden="true" />
          {t.saved}
        </span>
      ) : status?.state === 'error' ? (
        <span className="text-danger">{t.failed}</span>
      ) : null}
    </span>
  )
}

function StatusError({ status, locale }: { status?: Status; locale: Locale }) {
  if (status?.state !== 'error') return null
  return <ErrorNote error={status.error} onRetry={status.retry} locale={locale} compact />
}

function Row({
  id,
  label,
  hint,
  status,
  t,
  locale,
  children,
  wide = false,
}: {
  id: string
  label: string
  hint?: ReactNode
  status?: Status
  t: Dict['cabinet']['profile']['status']
  locale: Locale
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={cn('grid min-w-0 content-start gap-2', wide && 'sm:col-span-2')}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-muted">
          {label}
        </label>
        <FieldStatus status={status} t={t} />
      </div>
      {children}
      {hint ? (
        <p id={`${id}-help`} className="text-[13px] leading-relaxed text-faint">
          {hint}
        </p>
      ) : null}
      <StatusError status={status} locale={locale} />
    </div>
  )
}

type Ctx = ReturnType<typeof useProfile> & { t: Dict['cabinet']['profile']; locale: Locale; uid: string }

// Text input that saves on blur (and on Enter) when the value changed. On failure the typed text stays.
function TextInput({
  ctx,
  field,
  label,
  hint,
  placeholder,
  type = 'text',
  autoComplete,
  maxLength,
  wide,
  inputMode,
}: {
  ctx: Ctx
  field: Extract<ProfileField, 'name' | 'telegram' | 'phone' | 'company' | 'website' | 'city' | 'legalName' | 'legalAddress' | 'refundWallet'>
  label: string
  hint?: ReactNode
  placeholder?: string
  type?: string
  autoComplete?: string
  maxLength: number
  wide?: boolean
  inputMode?: 'text' | 'tel' | 'url'
}) {
  const stored = ctx.profile[field]
  const [draft, setDraft] = useState(stored)
  const [seen, setSeen] = useState(stored)
  if (stored !== seen) {
    setSeen(stored)
    setDraft(stored)
  }
  const id = `${ctx.uid}-${field}`
  const status = ctx.status[field]
  function commit() {
    if (draft.trim() === stored.trim()) {
      if (draft !== stored) setDraft(stored)
      return
    }
    void ctx.save({ [field]: draft })
  }
  return (
    <Row id={id} label={label} hint={hint} status={status} t={ctx.t.status} locale={ctx.locale} wide={wide}>
      <input
        id={id}
        name={field}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={field === 'telegram' || field === 'website' || field === 'refundWallet' ? 'none' : undefined}
        spellCheck={field === 'telegram' || field === 'website' || field === 'refundWallet' ? false : undefined}
        maxLength={maxLength}
        aria-invalid={status?.state === 'error' ? true : undefined}
        aria-describedby={hint ? `${id}-help` : undefined}
        className={inputClass}
      />
    </Row>
  )
}

// A switch: flips at once, saves, flips back with the reason on failure.
function Switch({
  ctx,
  field,
  title,
  text,
}: {
  ctx: Ctx
  field: 'marketing' | 'recommendations'
  title: string
  text: string
}) {
  const id = `${ctx.uid}-${field}`
  const on = ctx.profile[field]
  const status = ctx.status[field]
  async function flip() {
    if (status?.state === 'saving') return
    const before = ctx.profile
    ctx.setProfile({ ...before, [field]: !on })
    const ok = await ctx.save({ [field]: !on })
    if (!ok) ctx.setProfile((p) => ({ ...p, [field]: before[field] }))
  }
  return (
    <div className="grid gap-2 py-4" data-pref={field}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={`${id}-label`} className="text-[15px] font-medium text-fg">
            {title}
          </p>
          <p id={`${id}-text`} className="mt-1 text-[13px] leading-relaxed text-faint">
            {text}
          </p>
          <FieldStatus status={status} t={ctx.t.status} />
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-text`}
          aria-busy={status?.state === 'saving'}
          onClick={flip}
          className={cn(
            'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
            on ? 'border-transparent bg-accent' : 'border-line-strong bg-fg/10',
            status?.state === 'saving' && 'cursor-progress',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-0.5 size-[22px] rounded-full shadow-sm transition-transform duration-150 ease-out',
              on ? 'translate-x-5 bg-accent-ink' : 'translate-x-0 bg-bg',
            )}
          />
        </button>
      </div>
      <StatusError status={status} locale={ctx.locale} />
    </div>
  )
}

function Section({ id, title, text, badge, children }: { id: string; title: string; text: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28 rounded-card border border-line bg-surface p-5 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={`${id}-title`} className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h3>
        {badge}
      </div>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted">{text}</p>
      <div className="mt-6">{children}</div>
    </section>
  )
}

const SECTIONS = ['you', 'company', 'docs', 'notify', 'security'] as const

export function ProfilePanel({
  dict,
  locale,
  initial,
  legacy,
  niches,
  hasPassword,
}: {
  dict: Dict
  locale: Locale
  initial: ProfileView
  legacy: boolean
  niches: NicheGroup[]
  hasPassword: boolean
}) {
  const t = dict.cabinet.profile
  const uid = useId()
  const state = useProfile(initial, locale)
  const ctx: Ctx = { ...state, t, locale, uid }
  const { profile } = state
  const [active, setActive] = useState<(typeof SECTIONS)[number]>('you')

  // The section nav follows the scroll (desktop rail).
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(`profile-${s}`)).filter(Boolean) as HTMLElement[]
    if (!('IntersectionObserver' in window) || els.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActive(hit.target.id.replace('profile-', '') as (typeof SECTIONS)[number])
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    for (const el of els) io.observe(el)
    return () => io.disconnect()
  }, [])

  const selectStatus = (field: ProfileField) => ctx.status[field]
  const channelStatus = ctx.status.notifyChannel

  async function pick(field: 'locale' | 'niche' | 'notifyChannel', value: string) {
    const before = profile
    state.setProfile({ ...before, [field]: value })
    const ok = await state.save({ [field]: value } as ProfilePatch)
    if (!ok) state.setProfile((p) => ({ ...p, [field]: before[field] }))
  }

  const sectionTitle = { you: t.you.title, company: t.company.title, docs: t.docs.title, notify: t.notify.title, security: t.security.title }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10" data-profile-panel>
      <nav aria-label={t.sectionsLabel} className="min-w-0 md:sticky md:top-28 md:self-start">
        <h2 className="font-display text-2xl font-semibold tracking-tight">{t.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-faint">{t.intro}</p>
        <ul className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:gap-1 md:overflow-visible md:px-0">
          {SECTIONS.map((s) => (
            <li key={s} className="shrink-0">
              <a
                href={`#profile-${s}`}
                aria-current={active === s ? 'true' : undefined}
                className={cn(
                  'block rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors md:rounded-xl md:border-transparent md:px-3 md:py-2',
                  active === s ? 'border-accent-text/50 text-fg md:bg-fg/5' : 'border-line text-muted hover:text-fg',
                )}
              >
                {sectionTitle[s]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid min-w-0 gap-5">
        {legacy && (
          <p role="status" className="rounded-xl border border-warn/40 px-4 py-3 text-sm text-muted">
            {t.legacy}
          </p>
        )}

        <Section id="profile-you" title={t.you.title} text={t.you.text}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput ctx={ctx} field="name" label={t.you.name} placeholder={t.you.namePlaceholder} autoComplete="name" maxLength={80} />
            <div className="grid min-w-0 content-start gap-2">
              <label htmlFor={`${uid}-email`} className="text-sm text-muted">
                {t.you.email}
              </label>
              <input id={`${uid}-email`} value={profile.email} readOnly aria-describedby={`${uid}-email-help`} className={cn(inputClass, 'text-muted')} />
              <p id={`${uid}-email-help`} className="text-[13px] leading-relaxed text-faint">
                <a href="#profile-security" className="underline decoration-line-strong underline-offset-4 hover:text-fg">
                  {t.you.emailHint}
                </a>
              </p>
            </div>
            <TextInput ctx={ctx} field="telegram" label={t.you.telegram} hint={t.you.telegramHint} placeholder="@name" maxLength={60} />
            <TextInput ctx={ctx} field="phone" label={t.you.phone} hint={t.you.phoneHint} placeholder="+992 900 12 34 56" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} />
            <Row id={`${uid}-locale`} label={t.you.language} status={selectStatus('locale')} t={t.status} locale={locale}>
              <select id={`${uid}-locale`} value={profile.locale} onChange={(e) => void pick('locale', e.target.value)} className={inputClass}>
                <option value="ru">{t.you.languages.ru}</option>
                <option value="en">{t.you.languages.en}</option>
              </select>
            </Row>
          </div>
        </Section>

        <Section id="profile-company" title={t.company.title} text={t.company.text}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput ctx={ctx} field="company" label={t.company.name} placeholder={t.company.namePlaceholder} autoComplete="organization" maxLength={120} />
            <Row id={`${uid}-niche`} label={t.company.niche} status={selectStatus('niche')} t={t.status} locale={locale}>
              <select id={`${uid}-niche`} value={profile.niche} onChange={(e) => void pick('niche', e.target.value)} className={inputClass}>
                <option value="">{t.company.nicheNone}</option>
                {niches.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Row>
            <TextInput ctx={ctx} field="website" label={t.company.website} hint={t.company.websiteHint} placeholder={t.company.websitePlaceholder} type="text" inputMode="url" autoComplete="url" maxLength={200} />
            <TextInput ctx={ctx} field="city" label={t.company.city} placeholder={t.company.cityPlaceholder} autoComplete="address-level2" maxLength={80} />
          </div>
        </Section>

        <Section
          id="profile-docs"
          title={t.docs.title}
          text={t.docs.text}
          badge={
            <span className="inline-flex items-center rounded-full border border-accent-text/40 px-2.5 py-0.5 font-mono text-[11px] text-accent-text">
              {t.docs.badge}
            </span>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextInput ctx={ctx} field="legalName" label={t.docs.legalName} hint={t.docs.legalNameHint} maxLength={160} wide />
            <TextInput ctx={ctx} field="legalAddress" label={t.docs.legalAddress} hint={t.docs.legalAddressHint} autoComplete="street-address" maxLength={300} wide />
            <TextInput ctx={ctx} field="refundWallet" label={t.docs.wallet} hint={t.docs.walletHint} maxLength={120} wide />
          </div>
        </Section>

        <Section id="profile-notify" title={t.notify.title} text={t.notify.text}>
          <div className="divide-y divide-line">
            <div className="flex items-start justify-between gap-4 pb-4" data-pref="project">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-fg">{t.notify.project}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-faint">{t.notify.projectText}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[12px] whitespace-nowrap text-muted">
                <LockSimple size={12} aria-hidden="true" />
                {t.notify.locked}
              </span>
            </div>
            <Switch ctx={ctx} field="marketing" title={t.notify.marketing} text={t.notify.marketingText} />
            <Switch ctx={ctx} field="recommendations" title={t.notify.recommendations} text={t.notify.recommendationsText} />
            <div className="grid gap-3 pt-4" data-pref="channel">
              <div className="flex items-center justify-between gap-3">
                <p id={`${uid}-channel-label`} className="text-[15px] font-medium text-fg">
                  {t.notify.channel}
                </p>
                <FieldStatus status={channelStatus} t={t.status} />
              </div>
              <div role="radiogroup" aria-labelledby={`${uid}-channel-label`} className="grid gap-2 sm:grid-cols-3">
                {(['email', 'telegram', 'both'] as NotifyChannel[]).map((c) => {
                  const disabled = c !== 'email' && !profile.telegram
                  const checked = profile.notifyChannel === c
                  return (
                    <label
                      key={c}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors',
                        checked ? 'border-accent-text bg-fg/5 text-fg' : 'border-line-strong text-muted hover:text-fg',
                        disabled && 'cursor-not-allowed opacity-50 hover:text-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name={`${uid}-channel`}
                        value={c}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => void pick('notifyChannel', c)}
                        className="size-4 accent-[var(--color-accent-text)]"
                      />
                      {t.notify.channels[c]}
                    </label>
                  )
                })}
              </div>
              {!profile.telegram && <p className="text-[13px] text-faint">{t.notify.needTelegram}</p>}
              <StatusError status={channelStatus} locale={locale} />
            </div>
          </div>
        </Section>

        <Section id="profile-security" title={t.security.title} text={t.security.text}>
          <ProfileSecurity dict={dict} locale={locale} hasPassword={hasPassword} />
        </Section>
      </div>
    </div>
  )
}
