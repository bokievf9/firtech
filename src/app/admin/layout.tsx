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

export const viewport: Viewport = { themeColor: '#0a0d0b', colorScheme: 'light dark' }

// Runs before the first paint so a light-theme owner never sees a dark flash. The choice lives in
// localStorage (see ThemeToggle); dark is the default and any failure keeps it.
const themeScript = `try{if(localStorage.getItem('firtech-admin-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${onest.variable} ${jetbrains.variable} ${unbounded.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh]">{children}</body>
    </html>
  )
}
