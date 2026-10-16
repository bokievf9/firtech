import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/login-form'
import { Logo } from '@/components/logo'
import { admin } from '@/content/admin'
import { hasAdminSession } from '@/lib/admin-page'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect('/admin')
  return (
    <div className="dot-grid flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-7 shadow-2xl">
        <Logo className="text-[22px]" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{admin.login.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{admin.login.lead}</p>
        <LoginForm />
      </div>
    </div>
  )
}
