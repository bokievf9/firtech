'use client'

import { useCallback } from 'react'
import { errText, fill, hq, usePoll } from '@/components/admin/control/api'
import { runOrder } from '@/components/admin/control/orders-run'
import { admin } from '@/content/admin'
import { decisionGone, editApproval, withoutApproval, type Approval, type HqState, type Id } from '@/lib/hq-admin-view'

const cc = admin.cc
type Items<T> = { items: T[] }

// The approvals queue of HQ for the Inbox: the same calls as the pixel hub (approve, reject, edit,
// release the queue), optimistic with a rollback and a toast. `notify` is the shell's toast.
export function useApprovals(notify: (text: string, tone?: 'info' | 'error') => void) {
  const approvals = usePoll<Items<Approval>>('approvals')
  const state = usePoll<HqState>('state')
  const { mutate, reload } = approvals
  const { reload: reloadState } = state

  const onAct = useCallback(
    async (a: Approval, action: 'approve' | 'reject', part?: Id) => {
      mutate((d) => ({ ...d, items: withoutApproval(d.items, a.id) }))
      const res = await hq<{ status: string; message?: string }>(`approvals/${encodeURIComponent(String(a.id))}`, {
        action,
        ...(part !== undefined ? { part } : {}),
      })
      if (decisionGone(res)) {
        const message = res.ok && typeof res.message === 'string' && res.message ? res.message : null
        notify(
          !res.ok
            ? fill(cc.approvals.already, { s: a.summary })
            : (message ?? fill(action === 'approve' ? cc.approvals.approved : cc.approvals.rejected, { s: a.summary })),
        )
        void reload()
        void reloadState()
      } else {
        mutate((d) => ({ ...d, items: [...withoutApproval(d.items, a.id), a] }))
        notify(fill(cc.approvals.failed, { e: errText(res.ok ? 'hq_error' : res.error) }), 'error')
      }
    },
    [mutate, notify, reload, reloadState],
  )

  const onEdit = useCallback(
    async (a: Approval, text: string, part?: Id) => {
      mutate((d) => ({ ...d, items: editApproval(d.items, a.id, text) }))
      const res = await hq<{ message?: string }>(`approvals/${encodeURIComponent(String(a.id))}`, {
        action: 'edit',
        text,
        ...(part !== undefined ? { part } : {}),
      })
      if (res.ok) {
        notify(typeof res.message === 'string' && res.message ? res.message : cc.approvals.edited)
        return true
      }
      mutate((d) => ({ ...d, items: editApproval(d.items, a.id, a.text) }))
      notify(fill(cc.approvals.failed, { e: errText(res.error) }), 'error')
      return false
    },
    [mutate, notify],
  )

  const onRelease = useCallback(async () => {
    const res = await runOrder({ kind: 'command', name: 'approve', arg: '' })
    if (!res.ok) notify(fill(cc.approvals.failed, { e: errText(res.error) }), 'error')
    await reload()
    await reloadState()
  }, [notify, reload, reloadState])

  return {
    items: approvals.data?.items ?? null,
    error: approvals.error,
    queued: state.data?.approvalsQueued ?? 0,
    onAct,
    onEdit,
    onRelease,
  }
}
