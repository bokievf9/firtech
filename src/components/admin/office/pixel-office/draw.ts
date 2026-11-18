// Low-level canvas helpers for the pixel office: rectangles, pixel text and a cache of sprites
// rendered once per palette. Everything is in logical pixels; the scene sets the integer scale.

import { forEachTextPixel } from './font'
import type { Palette } from './palette'
import type { Sprite } from './sprites'

export type Ctx = CanvasRenderingContext2D

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

export function context(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2d canvas is not available')
  ctx.imageSmoothingEnabled = false
  return ctx
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

export function text(ctx: Ctx, s: string, x: number, y: number, color: string) {
  ctx.fillStyle = color
  forEachTextPixel(s, x, y, (px, py) => ctx.fillRect(px, py, 1, 1))
}

// Draws a sprite pixel by pixel; used only to fill the cache below and the static layers.
export function paintSprite(ctx: Ctx, sprite: Sprite, x: number, y: number, palette: Palette, flip = false) {
  for (let sy = 0; sy < sprite.h; sy++) {
    for (let sx = 0; sx < sprite.w; sx++) {
      const key = sprite.px[sy * sprite.w + sx]
      if (!key) continue
      const color = palette[key]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + (flip ? sprite.w - 1 - sx : sx), y + sy, 1, 1)
    }
  }
}

// One small canvas per (sprite, palette, direction); drawImage of it is all a frame costs.
export function spriteCache() {
  const cache = new Map<string, HTMLCanvasElement>()
  return (name: string, sprite: Sprite, palette: Palette, paletteKey: string, flip: boolean) => {
    const key = `${name}|${paletteKey}|${flip ? 1 : 0}`
    let c = cache.get(key)
    if (!c) {
      c = makeCanvas(sprite.w, sprite.h)
      paintSprite(context(c), sprite, 0, 0, palette, flip)
      cache.set(key, c)
    }
    return c
  }
}
