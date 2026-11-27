'use client'

import { useEffect, useRef, useState } from 'react'

// True once the element has been in view (at the given share), for one-shot reactions. A DOM observer, no per-frame work.
export function useSeen<T extends HTMLElement>(threshold = 0.6) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        setSeen(true)
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, seen }
}
