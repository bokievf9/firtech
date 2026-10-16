'use client'

import { DownloadSimple, SignOut } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Logo } from '@/components/logo'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

const links = [
  { href: '/admin', label: admin.nav.overview },
  { href: '/admin/leads', label: admin.nav.leads },
  { href: '/admin/calendar', label: admin.nav.calendar },
] as const

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout(all: boolean) {
    if (all && !window.confirm(admin.nav.logoutAllConfirm)) return
    setBusy(true)
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all }),
    }).catch(() => null)
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1440px] flex-col px-4 pb-10 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Logo className="text-[17px]" />
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] tracking-wide text-faint uppercase">
            admin
          </span>
        </Link>
        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {links.map((link) => {
            const active =
              link.href === '/admin' ? pathname === '/admin' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm transition-colors',
                  active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* A file download from a route handler, not a page, so a plain link. */}
          <a
            href="/api/admin/export"
            download
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm text-fg transition-colors hover:border-accent hover:text-accent"
          >
            <DownloadSimple size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{admin.nav.export}</span>
            <span className="sm:hidden">CSV</span>
          </a>
          <details className="relative">
            <summary
              aria-label={admin.nav.logout}
              className="flex cursor-pointer list-none items-center rounded-full border border-line px-3 py-2 text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden"
            >
              <SignOut size={16} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-64 rounded-card border border-line-strong bg-surface-2 p-2 shadow-2xl">
              <button
                type="button"
                disabled={busy}
                onClick={() => logout(false)}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-surface"
              >
                {admin.nav.logout}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => logout(true)}
                className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-danger hover:bg-surface"
              >
                {admin.nav.logoutAll}
              </button>
            </div>
          </details>
        </div>
      </header>
      <main className="flex-1 pt-6">{children}</main>
    </div>
  )
}

// One dashboard panel: a separate surface with an optional title row.
export function Panel({
  title,
  aside,
  className,
  children,
}: {
  title?: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface p-5', className)}>
      {title ? (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">{title}</h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  )
}
