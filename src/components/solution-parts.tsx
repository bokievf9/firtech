import type { Dict } from '@/content'
import { builderUi, pick, productCatalog } from '@/content/builder-catalog'
import { quote, presets } from '@/lib/builder'
import { cn } from '@/lib/cn'
import { bundleDiscount, formatUsd } from '@/lib/pricing'
import { serviceSlugs, type ServiceSlug } from '@/lib/site'
import type { SolutionKind } from '@/lib/solutions'

type Variants = Record<string, { name: string; term: string }>

export const usdRange = (r: { min: number; max: number }) =>
  `${formatUsd(r.min)} - ${formatUsd(r.max)}`

function isService(id: string): id is ServiceSlug {
  return (serviceSlugs as readonly string[]).includes(id)
}

// The kind's builder preset as a readable list: each part with its format, options, term and price,
// then the one-time total (with the bundle discount when it applies) and the monthly extras apart.
// Terms stay per part and are never summed, like in the builder.
export function SolutionSet({
  kind,
  dict,
  locale,
}: {
  kind: SolutionKind
  dict: Dict
  locale: string
}) {
  const t = dict.solutions
  const b = dict.builder
  const build = presets[kind]
  const q = quote(build)

  return (
    <div className="rounded-card border border-line bg-surface p-5 md:p-8">
      {build.products?.length ? (
        <div className="mb-6">
          <p className="text-xs tracking-[0.12em] text-faint uppercase">
            {pick(builderUi.recommendedProducts, locale)}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {build.products.map((id) => (
              <li
                key={id}
                className="rounded-full border border-accent/50 bg-accent/[0.06] px-3 py-1 text-sm"
              >
                {pick(productCatalog[id].name, locale)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul className="divide-y divide-line border-y border-line">
        {q.lines.map((line) => {
          if (!isService(line.id)) {
            return (
              <li key={line.id} className="flex items-start justify-between gap-4 py-5">
                <span className="font-medium">{dict.extras.items[line.id].name}</span>
                <span className="shrink-0 font-mono text-sm">{usdRange(line)}</span>
              </li>
            )
          }
          const part = build.parts[line.id]
          const c = dict.estimator.catalog[line.id]
          const variant = part ? (c.variants as Variants)[part.variant] : undefined
          const addons = (part?.addons ?? []).map((id) => (c.addons as Record<string, string>)[id])
          return (
            <li key={line.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:gap-6">
              <div>
                <p className="font-medium">
                  {dict.services.items[line.id].name}
                  {variant && <span className="text-muted">: {variant.name}</span>}
                </p>
                {addons.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {addons.map((name) => (
                      <li
                        key={name}
                        className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-4 sm:block sm:text-right">
                <p className="font-mono text-sm">{usdRange(line)}</p>
                {variant && (
                  <p className="text-xs text-faint sm:mt-1.5">
                    {t.term}: {variant.term}
                  </p>
                )}
              </div>
            </li>
          )
        })}
        {q.monthly !== null && (
          <li className="flex items-start justify-between gap-4 py-5">
            <span className="font-medium">{dict.extras.items.support.name}</span>
            <span className="shrink-0 font-mono text-sm">
              {formatUsd(q.monthly)}
              {b.perMonth}
            </span>
          </li>
        )}
      </ul>
      <dl className="mt-5 grid gap-2 text-sm">
        {q.discount && (
          <>
            <Row label={b.subtotal} value={usdRange(q.subtotal)} className="text-muted" />
            <Row
              label={b.discount}
              value={`-${Math.round(bundleDiscount * 100)}%`}
              className="text-accent"
            />
          </>
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <dt>{b.total}</dt>
          <dd className="font-mono text-2xl text-accent">{usdRange(q.total)}</dd>
        </div>
      </dl>
      <ul className="mt-6 grid gap-2 text-[13px] leading-relaxed text-faint">
        <li>{b.termsNote}</li>
        <li>{b.payNote}</li>
        {q.monthly !== null && <li>{b.monthlyNote}</li>}
        <li>{b.note}</li>
      </ul>
    </div>
  )
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt>{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  )
}
