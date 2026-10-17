// The hero headline, line by line from under a mask (`.hero-line` in globals.css, CSS only, so it
// runs on first paint without JavaScript). Decorative: the h1 also carries the plain sentence for
// search engines and screen readers.
export function HeroLines({ lines, accent }: { lines: string[]; accent: number }) {
  return (
    <span aria-hidden="true" className="block">
      {lines.map((line, i) => (
        <span key={line} className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
          <span
            className={i === accent ? 'hero-line block text-accent' : 'hero-line block'}
            style={{ animationDelay: `${0.05 + i * 0.12}s` }}
          >
            {line}
          </span>
        </span>
      ))}
    </span>
  )
}
