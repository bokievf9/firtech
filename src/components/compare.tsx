import { CheckCircle, MinusCircle } from '@phosphor-icons/react/ssr'
import type { Dict } from '@/content'
import { cn } from '@/lib/cn'
import { LogoMark } from './logo'
import { Reveal } from './reveal'
import { RiseText } from './rise-text'

// Freelancer vs agency vs us. A real table on wide screens with our column lit up; on phones each
// criterion becomes a small card, because a four-column table does not fit in 360px.
export function Compare({ dict }: { dict: Dict }) {
  const c = dict.compare
  const ours = c.columns.length - 1
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-36">
      <RiseText
        text={c.title}
        className="max-w-[18ch] text-4xl font-semibold tracking-[-0.035em] md:text-6xl"
      />
      <Reveal delay={0.15}>
        <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">{c.sub}</p>
      </Reveal>

      <Reveal className="mt-14 hidden md:block">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[24%]" />
            <col />
            <col />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="pb-5 text-sm font-normal text-faint">
                {c.criteria}
              </th>
              {c.columns.map((col, i) => (
                <th
                  key={col}
                  scope="col"
                  className={cn(
                    'px-6 pb-5 text-lg font-medium',
                    i === ours &&
                      'rounded-t-card border-x border-t border-accent/40 bg-accent/[0.06] pt-6',
                    i !== ours && 'text-muted',
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    {i === ours && <LogoMark className="size-6" />}
                    {col}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((row, r) => {
              const last = r === c.rows.length - 1
              return (
                <tr key={row.label}>
                  <th scope="row" className="border-t border-line py-6 pr-6 align-top font-medium">
                    {row.label}
                  </th>
                  {row.values.map((value, i) => (
                    <td
                      key={i}
                      className={cn(
                        'border-t px-6 py-6 align-top leading-snug',
                        i === ours
                          ? cn(
                              'border-x border-x-accent/40 border-t-accent/15 bg-accent/[0.06]',
                              last && 'rounded-b-card border-b border-b-accent/40',
                            )
                          : 'border-line text-muted',
                      )}
                    >
                      <span className="flex gap-2.5">
                        {i === ours ? (
                          <CheckCircle
                            size={20}
                            weight="fill"
                            className="mt-px shrink-0 text-accent"
                          />
                        ) : (
                          <MinusCircle
                            size={20}
                            weight="light"
                            className="mt-px shrink-0 text-faint"
                          />
                        )}
                        {value}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Reveal>

      <div className="mt-12 grid gap-3 md:hidden">
        {c.rows.map((row) => (
          <Reveal key={row.label}>
            <div className="rounded-card border border-line bg-surface p-5">
              <p className="font-medium">{row.label}</p>
              <dl className="mt-4 grid gap-3 text-[15px]">
                {row.values.map((value, i) => (
                  <div
                    key={i}
                    className={cn(
                      'grid grid-cols-[7.5rem_1fr] gap-3',
                      i === ours && '-mx-2 rounded-xl bg-accent/[0.07] px-2 py-2',
                    )}
                  >
                    <dt
                      className={cn(
                        'text-sm',
                        i === ours ? 'font-medium text-accent' : 'text-faint',
                      )}
                    >
                      {c.columns[i]}
                    </dt>
                    <dd className={i === ours ? 'text-fg' : 'text-muted'}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
