'use client'

import { useEffect } from 'react'
import { initSound } from '@/lib/sound'

// Mounted once in the locale layout: records the first user gesture and plays the CTA cue from one delegated
// listener (`[data-cta]`). Renders nothing, and does nothing audible while the sound toggle is off.
export function SoundListeners() {
  useEffect(() => initSound(), [])
  return null
}
