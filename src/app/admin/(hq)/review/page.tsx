import { redirect } from 'next/navigation'
import { approvalsHrefFor, parseItemId } from '@/lib/approvals'

export const dynamic = 'force-dynamic'

// The review centre became the reader inside Approvals (one place to approve): old links keep working.
// The session is checked by the Shell layout of this route group.
export default async function Page({ searchParams }: PageProps<'/admin/review'>) {
  redirect(approvalsHrefFor({ id: parseItemId((await searchParams).id) }))
}
