'use client'

import type { ReactNode } from 'react'
import { openChat } from './chat-events'

// A link that opens the chat widget. Without JavaScript it is a plain link to `fallbackHref`
// (the #demo section or the contact form), so it never does nothing.
export function ChatOpenButton({
  children,
  className,
  source,
  fallbackHref,
}: {
  children: ReactNode
  className?: string
  source: string
  fallbackHref: string
}) {
  return (
    <a
      href={fallbackHref}
      data-cta={`chat_${source}`}
      className={className}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.preventDefault()
        openChat(source)
      }}
    >
      {children}
    </a>
  )
}
