import type { Dict } from '@/content'
import type { Locale } from '@/lib/i18n'
import { productBuilderHref } from '@/lib/products'
import { DemoTabs, type DemoTabId } from './demo/demo-tabs'
import { SectionHeader } from './ui/section'

// «Попробуйте сейчас» (#demo): only live demos that call the real agent (owner 2026-11-23): the receptionist
// chat with its niche tabs and the «Персональный ИИ» chat. Signed out, each ends in the lock plate over a
// static example. No explainer tabs; those live inside the product pages.
export function DemoSection({ dict, locale }: { dict: Dict; locale: Locale }) {
  const d = dict.demoSection
  const names: Record<DemoTabId, string> = {
    receptionist: dict.products.items.receptionist.name,
    personal: dict.products.items.personal.name,
  }
  const buildHrefs: Record<DemoTabId, string> = {
    receptionist: productBuilderHref(locale, 'receptionist'),
    personal: productBuilderHref(locale, 'personal'),
  }
  return (
    <section id="demo" className="relative isolate scroll-mt-24 overflow-hidden py-section">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_75%_30%,var(--demo-glow),transparent_70%)]"
      />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <SectionHeader eyebrow={d.eyebrow} title={d.title} lead={d.sub} />
        <div className="mt-10">
          <DemoTabs dict={dict} locale={locale} names={names} buildHrefs={buildHrefs} />
        </div>
      </div>
    </section>
  )
}
