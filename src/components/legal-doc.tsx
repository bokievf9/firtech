import type { ReactNode } from 'react'

type Section = { id: string; title: string; text: string[]; list: string[] }

// A plain legal page (privacy policy, terms): header with the «draft» note, numbered sections.
// `extra` adds a block under a section (links the page decides on, such as the opt-out).
export function LegalDoc({
  t,
  idPrefix,
  sections,
  extra,
}: {
  t: { eyebrow: string; title: string; updated: string; draftNote: string; intro: string }
  idPrefix: string
  sections: Section[]
  extra?: (section: Section) => ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-32 pb-24 md:px-8 md:pt-40 md:pb-36">
      <header>
        <p className="font-mono text-xs tracking-[0.16em] text-accent-text uppercase">{t.eyebrow}</p>
        {/* "конфиденциальности" is one long word: smaller on phones, hyphenated if still too wide. */}
        <h1 className="mt-5 text-[2.1rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance hyphens-auto sm:text-[2.6rem] md:text-6xl">
          {t.title}
        </h1>
        <p className="mt-5 font-mono text-[13px] text-faint">{t.updated}</p>
        <p
          role="note"
          className="mt-4 inline-block rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] text-muted"
        >
          {t.draftNote}
        </p>
        <p className="mt-8 max-w-[62ch] text-lg leading-relaxed text-muted">{t.intro}</p>
      </header>

      <div className="mt-14 grid gap-12 border-t border-line pt-12">
        {sections.map((section, i) => (
          <section key={section.id} aria-labelledby={`${idPrefix}-${section.id}`}>
            <h2
              id={`${idPrefix}-${section.id}`}
              className="flex items-baseline gap-4 text-2xl font-semibold tracking-[-0.02em] md:text-[1.75rem]"
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
