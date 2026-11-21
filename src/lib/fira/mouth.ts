'use client'

import { useEffect, useState } from 'react'

// Lip-sync input for Fira: the loudness of an <audio> element as 0..1, read with a WebAudio
// analyser. ampFromBytes is the pure part (tested): time-domain bytes (128 = silence) to an RMS,
// gated against noise and gained so ordinary speech reaches about 0.6 to 0.9.
export function ampFromBytes(data: ArrayLike<number>, gate = 0.03, gain = 3.4): number {
  const n = data.length
  if (!n) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const s = ((data[i] ?? 128) - 128) / 128
    sum += s * s
  }
  const rms = Math.sqrt(sum / n)
  if (rms <= gate) return 0
  return Math.min(1, (rms - gate) * gain)
}

// Fast attack, slower release, so the mouth snaps open on a syllable and closes softly.
export function smoothAmp(prev: number, next: number, dt: number, attack = 0.035, release = 0.12): number {
  const tau = next > prev ? attack : release
  return prev + (next - prev) * (1 - Math.exp(-Math.max(dt, 0) / tau))
}

type Tap = { ctx: AudioContext; analyser: AnalyserNode }
const taps = new WeakMap<HTMLMediaElement, Tap>()

// createMediaElementSource may be called once per element, so the tap is cached.
function tapOf(el: HTMLMediaElement): Tap | null {
  const cached = taps.get(el)
  if (cached) return cached
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  ctx.createMediaElementSource(el).connect(analyser)
  analyser.connect(ctx.destination)
  const tap = { ctx, analyser }
  taps.set(el, tap)
  return tap
}

// Amplitude 0..1 of the audio element while it plays, about 30 updates a second. Pass the result
// to <Fira mouth={...} />. Returns 0 without an element or without WebAudio.
export function useMouthFromAudio(audioEl: HTMLMediaElement | null): number {
  const [amp, setAmp] = useState(0)
  useEffect(() => {
    if (!audioEl) return
    let tap: Tap | null = null
    try {
      tap = tapOf(audioEl)
    } catch {
      return
    }
    if (!tap) return
    const { ctx, analyser } = tap
    const buf = new Uint8Array(analyser.fftSize)
    const resume = () => void ctx.resume().catch(() => {})
    audioEl.addEventListener('play', resume)
    let raf = 0
    let last = performance.now()
    let value = 0
    let shown = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = (now - last) / 1000
      if (dt < 1 / 32) return
      last = now
      let target = 0
      if (!audioEl.paused && !audioEl.ended) {
        analyser.getByteTimeDomainData(buf)
        target = ampFromBytes(buf)
      }
      value = smoothAmp(value, target, dt)
      if (Math.abs(value - shown) > 0.02 || (value < 0.01 && shown !== 0)) {
        shown = value < 0.01 ? 0 : value
        setAmp(shown)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audioEl.removeEventListener('play', resume)
      setAmp(0)
    }
  }, [audioEl])
  return amp
}
