import { Children, type ReactNode } from 'react'

// Staggers the hero's headline, text and buttons in on first paint. Plain CSS (`.hero-rise` in
// globals.css), so the text is visible in the HTML and only slides up: the largest text on the
// first screen paints without waiting for JavaScript (LCP), and works with JavaScript off.
export function HeroIntro({
  children,
  className,
  delay = 0.08,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <div className="hero-rise" style={{ animationDelay: `${delay + i * 0.09}s` }}>
          {child}
        </div>
      ))}
    </div>
  )
}
