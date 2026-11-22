import { ArrowSquareOut } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { admin } from '@/content/admin'
import { isSoonSection, sectionById } from '@/lib/hq-shell'

const t = admin.hq

export async function generateMetadata({ params }: PageProps<'/admin/[section]'>) {
  const s = sectionById((await params).section)
  return { title: `Shell · ${s?.label ?? ''}` }
}

// A section that is not built yet (phase 2): says so and links to the old screen that holds it today.
export default async function SoonPage({ params }: PageProps<'/admin/[section]'>) {
  const id = (await params).section
  if (!isSoonSection(id)) notFound()
  const s = sectionById(id)!
  return (
    <div className="mx-auto max-w-xl p-6 sm:p-10" data-soon={id}>
      <h1 className="font-brand text-2xl">{s.label}</h1>
      <p className="mt-1 text-sm text-muted">{t.sectionHints[id]}</p>
      <div className="mt-6 rounded-card border border-dashed border-line-strong bg-surface p-5">
        <p className="text-sm font-medium">{t.soonTitle}</p>
        <p className="mt-1 text-sm text-muted">{t.soonText}</p>
        <Link
          href={s.legacy}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink"
        >
          {t.openOld}
          <ArrowSquareOut size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
