import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card } from '@/components/cabinet/ui'
import { getDict } from '@/content'
import { cabinetHealth } from '@/lib/cabinet-health'
import { pingHq } from '@/lib/cabinet-hq'
import { isLocale } from '@/lib/i18n'

// /[locale]/cabinet/health: which pieces of the cabinet are configured on this server, as yes/no,
// so the owner can see why sign-in or the cabinet data is off. Never a value, never indexed,
// never cached. Not in the sitemap (cabinet routes are left out).
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps<'/[locale]/cabinet/health'>): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return { title: getDict(locale).cabinet.health.metaTitle, robots: { index: false, follow: false } }
}

export default async function HealthPage({ params }: PageProps<'/[locale]/cabinet/health'>) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const t = getDict(locale).cabinet.health
  const health = cabinetHealth()
  const ping = await pingHq()
  const rows: [string, boolean, string?][] = [
    [t.supabaseUrl, health.supabaseUrl],
    [t.anonKey, health.anonKey],
    [t.serviceKey, health.serviceKey],
    [t.siteUrl, health.siteUrl],
    [t.hqConfigured, health.hqConfigured || ping === 'mock', ping === 'mock' ? 'mock' : undefined],
    [t.hqReachable, ping === 'ok' || ping === 'mock', ping === 'ok' ? undefined : ping],
    [t.leadIntake, health.leadIntake],
  ]
  return (
    <section className="mx-auto max-w-xl px-4 pt-32 pb-28 md:px-8 md:pt-40">
      <p className="text-caption text-accent-text font-medium">{t.eyebrow}</p>
      <h1 className="h-display mt-5 text-title">{t.title}</h1>
      <p className="mt-4 text-lead text-muted">{t.sub}</p>
      <div className="mt-10">
        <Card title={t.title}>
          <dl className="grid gap-3 text-callout" data-health>
            {rows.map(([label, ok, note]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-b-hairline border-line pb-3 last:border-0">
                <dt className="text-muted">{label}</dt>
                <dd className={ok ? 'font-mono text-accent-text' : 'font-mono text-danger'}>
                  {ok ? t.yes : t.no}
                  {note ? ` (${note})` : ''}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 font-mono text-caption text-faint">
            {t.checkedAt}: {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
          </p>
        </Card>
      </div>
    </section>
  )
}
