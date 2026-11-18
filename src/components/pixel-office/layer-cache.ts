// Cache of the static layers (building, furniture, props) per zoom level (Office v2). A layer is
// painted once at an integer device scale and blitted 1:1 every frame; it is repainted only when
// its content key (layout, sky, counters) or the scale changes. Huge scales fall back to the
// largest integer scale inside the pixel budget, and the blit scales the rest (nearest
// neighbour). No DOM here: the painter callback creates the canvas, so tests can count repaints.

// About 32 MB per layer at 4 bytes a pixel.
export const LAYER_BUDGET_PX = 8_000_000

// Integer scale a layer of w x h logical pixels is cached at for a device scale.
export function layerScale(deviceScale: number, w: number, h: number, budget = LAYER_BUDGET_PX): number {
  const want = Math.max(1, Math.round(deviceScale))
  const fits = Math.floor(Math.sqrt(budget / Math.max(1, w * h)))
  return Math.max(1, Math.min(want, fits))
}

export type LayerEntry<T> = { key: string; scale: number; value: T }

export function layerCache<T>(paint: (scale: number) => T) {
  let entry: LayerEntry<T> | null = null
  let repaints = 0
  return {
    // `content` changes with the data, `scale` with the zoom (and the screen's pixel ratio).
    get(content: string, scale: number): T {
      const key = `${content}@${scale}`
      if (!entry || entry.key !== key) {
        entry = { key, scale, value: paint(scale) }
        repaints++
      }
      return entry.value
    },
    scale: () => entry?.scale ?? 0,
    repaints: () => repaints,
    clear() {
      entry = null
    },
  }
}
