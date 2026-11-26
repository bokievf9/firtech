'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { accessoriesFor } from '@/lib/fira/contexts'
import { firaFace } from '@/lib/fira/face'
import type { ProductId } from '@/lib/product-ids'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { FiraFlat } from '../fira/fira-flat'
import { FiraTurtle7 } from '../fira/fira-turtle7'
import { productIcons } from '../products/product-icons'

// The orbit stage of the home hero (owner 2026-11-26): the living 3D Fira in the centre, the seven
// products travelling around her on one inclined ring. CSS 3D, not WebGL: the cards stay real links.
// The ring, every card's counter-rotation and its dimming are CSS animations on transform/opacity
// (phase set by a negative delay), so no JavaScript runs per frame. This component only pauses the
// ring (hover, focus, off screen, hidden tab) by flipping data attributes. Below `lg` the ring is a
// scrollable row; with reduced motion the ring stands still. Styles: `/* hero orbit */` in globals.css.
const acc = accessoriesFor('home')
export type OrbitProduct = { id: ProductId; name: string; benefit: string }

export function HeroOrbit({ locale, products, label, ring }: { locale: string; products: OrbitProduct[]; label: string; ring: string }) {
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const [liveOn, setLive] = useState(false)
  const live = liveOn && !reduce
  const [caption, setCaption] = useState<string>('')

  // The WebGL turtle replaces the flat one once the page is idle, on wide screens with motion allowed.
  useEffect(() => {
    if (reduce || !window.matchMedia('(min-width: 1024px)').matches) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLive(true))
      return () => w.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(() => setLive(true), 1200)
    return () => window.clearTimeout(id)
  }, [reduce])

  // Animate only while the stage is on screen and the tab is visible.
  useEffect(() => {
    const el = root.current
    if (!el) return
    let onScreen = true
    let visible = !document.hidden
    const sync = () => {
      el.dataset.idle = onScreen && visible ? 'false' : 'true'
    }
    const io = new IntersectionObserver(([entry]) => {
      onScreen = Boolean(entry?.isIntersecting)
      sync()
    })
    io.observe(el)
    const vis = () => {
      visible = !document.hidden
      sync()
    }
    document.addEventListener('visibilitychange', vis)
    sync()
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  const pause = (on: boolean, text = '') => {
    const el = root.current
    if (el) el.dataset.paused = on ? 'true' : 'false'
    setCaption(text)
  }
  const step = 360 / products.length

  return (
    <div className="orbit-wrap">
      <div ref={root} data-hero-orbit data-paused="false" data-idle="false" className="orbit-stage">
        <div aria-hidden="true" className="orbit-glow" />
        <div className="orbit-scene">
          <div className="orbit-tilt">
            <div className="orbit-fira">
              <div className="orbit-fira-box" data-fira-hero={live ? 'webgl' : 'svg'}>
                {live ? (
                  <FiraTurtle7 variant={firaFace} acc={acc} emotion="idle" size={360} label={label} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <FiraFlat emotion="idle" context="home" className="relative block size-full" />
                )}
              </div>
            </div>
            <ol aria-label={ring} className="orbit-ring">
              {products.map((p, i) => {
                const Icon = productIcons[p.id]
                return (
                  <li key={p.id} className="orbit-item" style={{ '--th': `${i * step}deg`, '--ph': `${(i / products.length).toFixed(4)}` } as React.CSSProperties}>
                    <Link
                      href={`/${locale}/products/${p.id}`}
                      data-orbit-card={p.id}
                      data-cta="hero_product"
                      className="orbit-card glass"
                      onPointerEnter={() => pause(true, p.benefit)}
                      onPointerLeave={() => pause(false)}
                      onFocus={() => pause(true, p.benefit)}
                      onBlur={() => pause(false)}
                    >
                      <Icon size={20} weight="duotone" aria-hidden="true" className="shrink-0 text-accent-text" />
                      <span className="text-callout leading-tight font-medium text-balance text-fg">{p.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
      <p aria-live="polite" data-orbit-caption className="orbit-caption text-callout text-muted">
        {caption}
      </p>
    </div>
  )
}
