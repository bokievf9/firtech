import Link from 'next/link'
import type { Dict } from '@/content'
import { cabinetRefLink, label, type CabinetData } from '@/lib/cabinet-data'
import type { Locale } from '@/lib/i18n'
import { getPricing } from '@/lib/pricing-store'
import { fillReferralPercent } from '@/lib/referral'
import { CopyLink } from './cabinet-forms'
import { Card, Chip, Empty } from './ui'

// The «Рекомендации» card (server component). Labels come from `cabinet.cards` and `cabinet.referral`.

export async function ReferralsCard({ data, dict, locale }: { data: CabinetData; dict: Dict; locale: Locale }) {
  const t = dict.cabinet.referral
  const c = dict.cabinet.cards
  const pricing = await getPricing()
  const link = cabinetRefLink(locale, data.referralSlug)
  return (
    <Card title={c.referrals} id="cabinet-referrals">
      <div className="grid gap-5">
        <p className="text-sm leading-relaxed text-muted">
          {fillReferralPercent(t.rule, pricing)}
        </p>
        {link ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium">{t.title}</p>
            <CopyLink link={link} dict={dict} />
          </div>
        ) : (
          <p className="text-[13px] text-faint">{t.pending}</p>
        )}
        <div>
          <p className="text-sm font-medium">{t.listTitle}</p>
          {data.referrals.length === 0 ? (
            <div className="mt-2">
              <Empty>{c.noReferrals}</Empty>
            </div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {data.referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{r.referred}</span>
                  <Chip tone={r.status === 'rewarded' ? 'accent' : 'muted'}>{label(c.referralStatus, r.status)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href={`/${locale}/referral`}
          className="justify-self-start text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg"
        >
          {t.more}
        </Link>
      </div>
    </Card>
  )
}
