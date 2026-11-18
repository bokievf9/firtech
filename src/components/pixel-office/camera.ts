// Camera of the admin office (Office v2): integer zoom 2x to 6x, pan, zoom around a point,
// follow. `x`/`y` are the logical pixel at the top-left corner of the view; `zoom` is CSS pixels
// per logical pixel. A building smaller than the view is centred. Pure module, covered by
// tests/pixel-office.test.mjs ("zoom clamping and pan bounds").

export const ZOOM_MIN = 2
export const ZOOM_MAX = 6

export type Camera = { zoom: number; x: number; y: number }
export type Size = { w: number; h: number }

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(Number.isFinite(z) ? z : ZOOM_MIN)))

// The largest integer zoom at which the whole building width fits the view (2..4 like before;
// deeper zoom is the owner's choice).
export function fitZoom(view: Size, world: Size, max = 4): number {
  if (view.w <= 0 || world.w <= 0) return ZOOM_MIN
  return Math.min(max, Math.max(ZOOM_MIN, Math.floor(view.w / world.w)))
}

// Keeps the view inside the building on each axis; centres the axis the building does not fill.
export function clampPan(cam: Camera, view: Size, world: Size): Camera {
  const zoom = clampZoom(cam.zoom)
  const axis = (pos: number, viewPx: number, worldPx: number) => {
    const span = viewPx / zoom
    if (span >= worldPx) return -(span - worldPx) / 2 || 0
    return Math.min(worldPx - span, Math.max(0, pos))
  }
  return { zoom, x: axis(cam.x, view.w, world.w), y: axis(cam.y, view.h, world.h) }
}

// The default view: fit zoom, building centred (or its left part on a narrow phone).
export function homeCamera(view: Size, world: Size): Camera {
  return clampPan({ zoom: fitZoom(view, world), x: 0, y: 0 }, view, world)
}

// Zooms to `zoom` keeping the logical point under (px, py) (CSS px inside the view) in place.
export function zoomAround(cam: Camera, zoom: number, px: number, py: number, view: Size, world: Size): Camera {
  const next = clampZoom(zoom)
  const lx = cam.x + px / cam.zoom
  const ly = cam.y + py / cam.zoom
  return clampPan({ zoom: next, x: lx - px / next, y: ly - py / next }, view, world)
}

export function panBy(cam: Camera, dx: number, dy: number, view: Size, world: Size): Camera {
  return clampPan({ zoom: cam.zoom, x: cam.x - dx / cam.zoom, y: cam.y - dy / cam.zoom }, view, world)
}

// Puts the logical point (lx, ly) in the middle of the view (as far as the bounds allow).
export function centerOn(cam: Camera, lx: number, ly: number, view: Size, world: Size): Camera {
  return clampPan({ zoom: cam.zoom, x: lx - view.w / cam.zoom / 2, y: ly - view.h / cam.zoom / 2 }, view, world)
}

// Moves `from` towards `to` by a share per frame (follow mode); snaps when close.
export function ease(from: Camera, to: Camera, share: number): Camera {
  const lerp = (a: number, b: number) => (Math.abs(b - a) < 0.05 ? b : a + (b - a) * share)
  return { zoom: to.zoom, x: lerp(from.x, to.x), y: lerp(from.y, to.y) }
}

export const sameCamera = (a: Camera, b: Camera) => a.zoom === b.zoom && a.x === b.x && a.y === b.y

// Logical point under a CSS pixel of the view.
export function toWorld(cam: Camera, px: number, py: number): { x: number; y: number } {
  return { x: cam.x + px / cam.zoom, y: cam.y + py / cam.zoom }
}
