'use client'

import dynamic from 'next/dynamic'
import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { StatusLine } from './status-line'
import { useOfficeFeed } from './use-office-feed'

// The canvas office is its own chunk, loaded after hydration; until then (and without JS) the
// window keeps its height, so nothing jumps.
const LiveOffice = dynamic(() => import('./live-office'), {
  ssr: false,
  loading: () => <OfficeSkeleton />,
})

function OfficeSkeleton() {
  return (
    <div className="h-[300px] w-full bg-[#0b1030]/60 min-[1580px]:h-[450px] min-[1880px]:h-[600px]" />
  )
}

// The hero's live layer: a framed window onto the public pixel office (real HQ statuses, or the
// labelled demo company) with the status line under it. One poll feeds both.
export function HeroLive({ locale, copy }: { locale: Locale; copy: Dict['hero']['live'] }) {
  const { data, receivedAt } = useOfficeFeed()
  return (
    <figure className="glass relative overflow-hidden rounded-panel">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="live-dot" data-demo={data ? data.demo : true} aria-hidden="true" />
        <span className="font-mono text-xs text-muted">{copy.window}</span>
        {data ? (
          <span
            className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-micro uppercase ${
              data.demo ? 'border-[#e8b33f]/40 text-[#e8b33f]' : 'border-accent-text/40 text-accent-text'
            }`}
          >
            {data.demo ? copy.demoBadge : copy.badge}
          </span>
        ) : null}
      </div>
      <div className="relative min-h-[300px] bg-[#0b1030] min-[1580px]:min-h-[450px] min-[1880px]:min-h-[600px]">
        {data ? <LiveOffice data={data} copy={copy} locale={locale} /> : <OfficeSkeleton />}
        {/* Soft edges so the scene sits in the glass instead of being cut by it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[#0b1030] to-transparent sm:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0b1030] to-transparent sm:hidden"
        />
      </div>
      <figcaption className="grid gap-2 px-4 py-4 sm:px-5">
        <StatusLine locale={locale} data={data} receivedAt={receivedAt} copy={copy} />
        <p className="text-xs leading-relaxed text-faint">
          {data?.demo ? copy.demoNote : copy.caption}
        </p>
      </figcaption>
    </figure>
  )
}
