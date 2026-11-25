import type { ReactNode } from 'react'
import { PageHero } from './page-hero'

type Section = { id: string; title: string; text: string[]; list: string[] }

// A plain legal page (privacy policy, terms): header with the «draft» note, numbered sections.
// `extra` adds a block under a section (links the page decides on, such as the opt-out).
export function LegalDoc({
  t,
  idPrefix,
  sections,
  extra,
}: {
  t: { eyebrow: string; title: string; titleLight: string; titleStrong: string; updated: string; draftNote: string; intro: string }
  idPrefix: string
  sections: Section[]
  extra?: (section: Section) => ReactNode
}) {
  return (
    <article>
      <PageHero light={t.titleLight} strong={t.titleStrong} lead={t.intro} narrow>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <p className="font-mono text-faint">{t.updated}</p>
          <p role="note" className="rounded-full border border-line-strong px-3.5 py-1.5 text-muted">
            {t.draftNote}
          </p>
        </div>
      </PageHero>

      <div className="mx-auto grid max-w-3xl gap-0 border-t border-line px-4 pb-24 md:px-8 md:pb-36 [&>section]:border-b [&>section]:border-line [&>section]:py-10">
        {sections.map((section, i) => (
          <section key={section.id} aria-labelledby={`${idPrefix}-${section.id}`}>
            <h2
              id={`${idPrefix}-${section.id}`}
              className="flex items-baseline gap-4 text-title-3 font-extrabold tracking-[-0.025em]"
            >
              <span className="font-mono text-sm font-normal text-accent-text">
                {String(i + 1).padStart(2, '0')}
              </span>
              {section.title}
            </h2>
            <div className="mt-4 grid max-w-[65ch] gap-4 leading-relaxed text-muted">
              {section.text.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.list.length > 0 && (
                <ul className="grid gap-2 pl-5 marker:text-accent-text [list-style:disc]">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {extra?.(section)}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
