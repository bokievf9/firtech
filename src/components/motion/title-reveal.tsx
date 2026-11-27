import { Fragment, type ReactNode } from 'react'

// T-A title reveal: the words of a heading rise 0.5em and fade in, 40 ms apart (the first eight; the rest arrive
// with the eighth), once on load. Plain server markup plus a CSS animation (`.scene-w` in globals.css): the words are
// real text in the HTML, nothing waits for JavaScript (LCP stays the h1), reduced motion shows the text at once.
// A heading that is not a plain string renders as it is.
export function TitleReveal({
  as: Tag = 'h1',
  className,
  children,
  id,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'p'
  className?: string
  children: ReactNode
  id?: string
}) {
  if (typeof children !== 'string') {
    return (
      <Tag id={id} className={className}>
        {children}
      </Tag>
    )
  }
  const words = children.split(' ')
  return (
    <Tag id={id} className={`scene-title ${className ?? ''}`.trim()}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="scene-w" style={{ ['--i' as string]: Math.min(i, 7) }}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  )
}
