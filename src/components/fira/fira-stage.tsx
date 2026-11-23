'use client'

import { accessoriesFor } from '@/lib/fira/contexts'
import { firaFace } from '@/lib/fira/face'
import { FiraFallback7 } from './fira-fallback7'
import { useFiraLive } from './fira-live-store'

// The stage slot of the chat header. F1 placeholder: the flat Fira (FiraFallback7) in the chat's headphones, with the
// emotion of the shared state; F2 replaces this file with the animated presence, the props stay.
export function FiraStage({ size = 44, className = '' }: { size?: number; className?: string }) {
  const live = useFiraLive()
  return (
    <span data-fira-stage={live.state} className={`block ${className}`} style={{ width: size, height: size }}>
      <FiraFallback7 variant={firaFace} acc={accessoriesFor('chat')} emotion={live.state} className="block size-full" />
    </span>
  )
}
