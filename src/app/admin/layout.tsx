import type { Metadata, Viewport } from 'next'
import { admin } from '@/content/admin'
import { jetbrains, onest, unbounded } from '../fonts'
import '../globals.css'

// Owner panel: its own root layout (no site header, footer or analytics), never indexed.
export const metadata: Metadata = {
  title: admin.meta.title,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export const viewport: Viewport = { themeColor: '#0a0d0b', colorScheme: 'dark' }

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <html lang="ru" className={`${onest.variable} ${jetbrains.variable} ${unbounded.variable}`}>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  )
}
