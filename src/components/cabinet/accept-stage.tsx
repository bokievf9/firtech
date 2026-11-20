'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Dict } from '@/content'
import { acceptErrorKey } from '@/lib/cabinet-data'
import { buttonStyles } from '@/lib/cn'
import { FormMessage } from './ui'

// «Принять этап»: POST /api/cabinet/projects/<pid>/milestones/<no>/accept, then the page is
// refreshed so the stage shows as accepted and the next invoice link appears. HQ's refusals
// (still in work, not paid) become sentences; nothing but a code reaches this component.
export function AcceptStageButton({ dict, projectId, stageNo }: { dict: Dict; projectId: number; stageNo: number }) {
  const t = dict.cabinet.cards.milestones
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function accept() {
    setError('')
    setStatus('sending')
    try {
      const res = await fetch(`/api/cabinet/projects/${projectId}/milestones/${stageNo}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (res.ok && body?.ok) {
        setStatus('done')
        router.refresh()
        return
      }
      setError(t.errors[acceptErrorKey(body?.error)])
    } catch {
      setError(t.errors.network)
    }
    setStatus('idle')
  }

  return (
    <div className="grid justify-items-start gap-2" data-accept-stage={stageNo}>
      <p className="text-[13px] text-muted">{t.acceptHint}</p>
      <button
        type="button"
        onClick={() => void accept()}
        disabled={status !== 'idle'}
        className={buttonStyles.primary}
      >
        {status === 'sending' ? t.accepting : t.accept}
      </button>
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {status === 'done' && <FormMessage kind="ok">{t.acceptDone}</FormMessage>}
    </div>
  )
}
