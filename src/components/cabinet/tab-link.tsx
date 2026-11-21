'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { withTab, type CabinetTab } from '@/lib/cabinet-tabs'

// A link to another tab of the cabinet (and, through `extra`, to a document `doc` or a conversation
// `ref`). It changes the URL with the History API like the tab bar does, so the server page is not
// fetched again; the href is real, so it also works as a normal link (new tab, no script).
export function TabLink({
  tab,
  extra,
  className,
  children,
  ...rest
}: {
  tab: CabinetTab
  extra?: Record<string, string | null>
  className?: string
  children: ReactNode
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  return (
    <a
      href={withTab('', tab, extra)}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        window.history.pushState(null, '', withTab(window.location.search, tab, extra))
        window.scrollTo({ top: document.getElementById('cabinet-tabs')?.offsetTop ?? 0, behavior: 'auto' })
      }}
    >
      {children}
    </a>
  )
}
