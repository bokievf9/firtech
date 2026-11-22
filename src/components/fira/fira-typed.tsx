'use client'

import { useEffect, useState } from 'react'
import { WORD_MS, splitWords, wordCount, wordsShown } from '@/lib/fira/guide'
import { useReducedMotion } from '@/lib/use-reduced-motion'

// A speech bubble line that types word by word (≈180 ms a word). Under reduced motion the whole line is there at
// once. The full text is in the DOM for screen readers and keeps the bubble's size from jumping while it types.
export function FiraTyped({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduce = useReducedMotion()
  const words = splitWords(text)
  const [count, setCount] = useState(0)
  const shown = reduce ? words.length : Math.min(count, words.length)

  useEffect(() => {
    if (reduce) {
      onDone?.()
      return
    }
    const total = words.length
    const start = Date.now()
    // Wall-clock based, so a busy page types as fast as an idle one.
    const tick = () => {
      const n = wordCount(total, Date.now() - start, WORD_MS)
      setCount(n)
      if (n >= total) {
        window.clearInterval(id)
        onDone?.()
      }
    }
    const id = window.setInterval(tick, 60)
    const first = window.setTimeout(tick, 0)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(first)
    }
    // The words only change with the text (the component is keyed by it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduce])

  return (
    <span className="grid" data-fira-typed={shown >= words.length ? 'done' : 'typing'}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">{text}</span>
      <span aria-hidden="true" data-fira-typed-text className="col-start-1 row-start-1">{wordsShown(words, shown)}</span>
    </span>
  )
}
