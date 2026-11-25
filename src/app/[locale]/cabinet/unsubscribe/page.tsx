import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HeroIntro } from '@/components/hero-intro'
import { getDict } from '@/content'
import { buttonStyles } from '@/lib/cn'
import { isLocale } from '@/lib/i18n'
import { unsubscribeSecret, verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { unsubscribeAction } from './actions'
import { UnsubscribeButton } from './unsubscribe-button'

// Public «Отписаться» page for links in letters (2026-11-22): `?token=` names one setting of one account
// (lib/unsubscribe.ts). No sign-in. Opening the page changes nothing; the button does (POST), so a mail
// scanner that follows links cannot unsubscribe anyone. One-click mail clients use POST /api/cabinet/unsubscribe.
export const dynamic = 'force-dynamic'

export default async function UnsubscribePage({ params, searchParams }: PageProps<'/[locale]/cabinet/unsubscribe'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDict(locale).cabinet.unsubscribe
  const query = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const token = one(query.token)
  const done = one(query.done)
  const error = one(query.error)
  const secret = unsubscribeSecret()
  const parsed = verifyUnsubscribeToken(token, secret)
  const what = parsed ? t.fields[parsed.field] : ''
  const fill = (s: string) => s.replace('{what}', what)

  let body: { text: string; tone: 'ok' | 'error' | 'ask' }
  if (error === 'not_found') body = { text: t.notFound, tone: 'error' }
  else if (error === 'save_failed') body = { text: t.failed, tone: 'error' }
  else if (!secret || error === 'not_configured') body = { text: t.notConfigured, tone: 'error' }
  else if (!parsed || error) body = { text: t.invalid, tone: 'error' }
  else if (done === 'already') body = { text: fill(t.already), tone: 'ok' }
  else if (done) body = { text: fill(t.done), tone: 'ok' }
  else body = { text: fill(t.ask), tone: 'ask' }

  return (
    <section className="mx-auto max-w-xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <HeroIntro>
        <p className="text-caption text-accent-text font-medium">{t.eyebrow}</p>
        <h1 className="h-display mt-5 text-title text-balance">{t.title}</h1>
      </HeroIntro>
      <div className="mt-8 grid gap-6">
        <p
          role={body.tone === 'error' ? 'alert' : 'status'}
          data-unsubscribe={body.tone}
          className={
            body.tone === 'error'
              ? 'rounded-tile border border-danger/40 bg-danger/10 px-4 py-3 text-danger'
              : body.tone === 'ok'
                ? 'rounded-tile border border-accent-text/40 px-4 py-3 text-fg'
                : 'text-lead text-muted'
          }
        >
          {body.text}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {body.tone === 'ask' && (
            <form action={unsubscribeAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <UnsubscribeButton label={t.button} pending={t.pending} />
            </form>
          )}
          <Link href={`/${locale}/cabinet?tab=profile#profile-notify`} className={body.tone === 'ask' ? 'text-callout text-muted underline underline-offset-4 hover:text-fg' : buttonStyles.secondary}>
            {t.toCabinet}
          </Link>
        </div>
      </div>
    </section>
  )
}
