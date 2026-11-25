import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { MotionProvider } from '@/components/motion-provider'
import { NotFoundView } from '@/components/not-found/not-found-view'
import { notFoundText } from '@/content/not-found'
import { jetbrains, manrope } from './fonts'
import './globals.css'

// Global 404 (next.config `experimental.globalNotFound`): paths outside /ru and /en, where no
// locale layout exists. Russian by default with a link to the English home page.
export const metadata: Metadata = {
  title: `404: ${notFoundText.ru.title} | Fir Tech`,
  robots: { index: false },
}

export default function GlobalNotFound() {
  return (
    <html lang="ru" className={`site ${manrope.variable} ${jetbrains.variable}`}>
      <body className="grain min-h-[100dvh]">
        <header className="fixed inset-x-0 top-0 z-40">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-[72px] md:px-8">
            <Link href="/ru" aria-label="Fir Tech">
              <Logo />
            </Link>
            <Link href="/en" hrefLang="en" className="font-mono text-xs text-muted uppercase hover:text-fg">
              en
            </Link>
          </div>
        </header>
        <MotionProvider>
          <main>
            <NotFoundView locale="ru" withChat={false} />
          </main>
        </MotionProvider>
      </body>
    </html>
  )
}
