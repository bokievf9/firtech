'use client'

import { useEffect } from 'react'

// Brings the element with this id into view once (a request opened by `?lead=<id>`).
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [id])
  return null
}
