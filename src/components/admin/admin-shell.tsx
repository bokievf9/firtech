'use client'

import { DownloadSimple, DotsThree } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ThemeToggle } from '@/components/admin/theme-toggle'
import { Logo } from '@/components/logo'
import { admin } from '@/content/admin'
import { cn } from '@/lib/cn'

// The only page of the owner panel is the control center; Echo (off) adds its own link when on.
const links = [{ href: '/admin/office', label: admin.nav.office }] as const

// `wide`: the пульт uses the whole screen: fluid up to 1760 px, then 88% of the viewport, so large
// and ultrawide screens get proportional side gutters instead of a fixed 1440 px column.
export function AdminShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname()

  return (
    <div
      className={cn(
        'mx-auto flex min-h-[100dvh] w-full flex-col px-4 pb-10 sm:px-6 lg:px-8',
        wide ? 'max-w-[max(1760px,88vw)]' : 'max-w-[1440px]',
      )}
    >
      <header className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link href="/admin/office" className="flex items-center gap-2.5">
          <Logo className="text-[17px]" />
          <span className="hidden rounded-full border border-line px-2.5 py-0.5 text-xs text-muted sm:inline">
            admin
          </span>
        </Link>
        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {links.map((link) => {
            const active = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm transition-colors',
                  active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AdminMenu />
        </div>
      </header>
      <main className="flex-1 pt-6">{children}</main>
    </div>
  )
}

// The «...» menu of the admin header (CSV export, logout); the пульт v3 top bar uses it too.
export function AdminMenu() {
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
    <details className="relative">
      <summary
        aria-label={admin.pulse.menu}
        className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-line text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden"
      >
        <DotsThree size={20} weight="bold" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-line-strong bg-surface-2 p-2 shadow-2xl">
        {/* A file download from a route handler, not a page, so a plain link. */}
        <a
          href="/api/admin/export"
          download
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-surface"
        >
          <DownloadSimple size={16} aria-hidden="true" />
          {admin.nav.export}
        </a>
        <button
          type="button"
          disabled={busy}
          onClick={() => logout(false)}
          className="min-h-11 w-full rounded-xl px-3 text-left text-sm hover:bg-surface"
        >
          {admin.nav.logout}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => logout(true)}
          className="min-h-11 w-full rounded-xl px-3 text-left text-sm text-danger hover:bg-surface"
        >
          {admin.nav.logoutAll}
        </button>
      </div>
    </details>
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
