// The pixel office's own palette. The scene is always drawn with these colours, in both admin
// themes (an office at night is dark either way). Sprites are strings of one-letter palette keys;
// see sprites.ts for the format. Pure module (no DOM), covered by tests/pixel-office.test.mjs.

export type Palette = Readonly<Record<string, string>>

// Keys shared by every sprite. People recolour `c`, `d`, `t`, `h`, `s`, `S` per agent (agentLook).
export const BASE: Palette = {
  k: '#1a1626', // outline
  e: '#1a1626', // eye
  s: '#f2c79f', // skin
  S: '#d29a72', // skin shade
  h: '#3b2a20', // hair
  c: '#5b8def', // shirt
  d: '#3f6bc4', // shirt shade, sleeves
  t: '#5b8def', // tie (shirt colour on workers, red on heads)
  p: '#2e3350', // trousers
  b: '#14121c', // shoes
  w: '#f4f1ea', // white: paper, cups, bubbles
  W: '#c9c3b6', // white shade
  m: '#c9ccd6', // metal light (iMac frame)
  M: '#8d93a3', // metal dark
  g: '#1b2440', // screen (redrawn live by the scene)
  o: '#b07a4a', // wood
  O: '#7f5533', // wood shade
  r: '#e0524b', // red
  l: '#b5eb6a', // fir lime
  n: '#5aa64f', // leaf
  N: '#2f6b33', // leaf shade
  q: '#8a5a3c', // pot
  y: '#ffd166', // warm light
  u: '#4a3f5c', // chair / sofa
  U: '#342c42', // chair shade
  '9': '#7fc4ff', // water
  // Office v2 props and icons.
  G: '#4fb08a', // green: check mark, LEDs
  B: '#5b8def', // blue: lens, web globe
  T: '#2aabee', // Telegram blue
  Y: '#e8b33f', // gold: award, bell
  x: '#2c313c', // dark panel
  z: '#14161c', // near black
  P: '#e86fa0', // pink: posters, flowers
  a: '#d9c9a3', // map paper
  i: '#6fa8c9', // map sea
}

// Fixed colours of the building and the rooms.
export const COLORS = {
  slab: '#2a2633',
  slabLine: '#3a3446',
  shell: '#3b3548',
  shellShade: '#2c2738',
  floor: '#5a4232',
  floorLine: '#4a3528',
  roof: '#2c2738',
  ground: '#3a3a40',
  street: '#26262c',
  stairs: '#4b4458',
  stairsEdge: '#6a6278',
  sign: '#1f1b29',
  signText: '#f4f1ea',
  frame: '#d8d2c4',
  frameShade: '#a9a294',
  city: '#141428',
  cityLit: '#ffd166',
  terminal: '#0c1410',
  terminalText: '#6cf08a',
  lime: '#b5eb6a',
  red: '#e0524b',
  ledOn: '#6cf08a',
  ledIdle: '#3d7a4a',
  ledBad: '#e0524b',
  ledOff: '#20242c',
  screenOn: '#7fd4ff',
  screenOn2: '#a6e4ff',
  screenCode: '#1f5f8f',
  screenDim: '#22305a',
  screenOff: '#0e0f14',
  night: '#0a0c1e',
} as const

// Back wall per room; departments not listed get one from WALLS_EXTRA by a hash of their id.
export const WALLS: Readonly<Record<string, string>> = {
  director: '#6b5a7a',
  meeting: '#56707a',
  marketing: '#7a6150',
  sales: '#5a7254',
  support: '#55657e',
  production: '#7a6a4c',
  'back-office': '#6a5868',
  backoffice: '#6a5868',
  builders: '#353a48',
  lounge: '#7a5a4a',
  servers: '#2b303b',
}
const WALLS_EXTRA = ['#6f6a52', '#5b6a72', '#735a5a', '#5f5a78']

const SHIRTS = [
  '#5b8def', '#e0784b', '#4fb08a', '#c45bd6', '#e8b33f', '#5bc3d6',
  '#d65b7a', '#7a8ce0', '#8fbf4a', '#e09a5b', '#9a6ad6', '#4f8fa6',
]
const HAIR = ['#3b2a20', '#1d1a1a', '#6b4226', '#a8712e', '#2c2a3a', '#7a5a3a']
const SKIN: readonly (readonly [string, string])[] = [
  ['#f2c79f', '#d29a72'],
  ['#e0ac7e', '#bb8257'],
  ['#c68a5c', '#9e6840'],
  ['#f5d6b8', '#d9ae8c'],
]

// FNV-1a, 32 bit: a small stable hash so an agent keeps its look and its timings across reloads.
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const pick = <T,>(list: readonly T[], n: number): T => list[n % list.length] as T

// "#rrggbb" darker or lighter by `amount` (-1..1).
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) =>
    Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)
      .toString(16)
      .padStart(2, '0')
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`
}

// Linear mix of two "#rrggbb" colours, t in 0..1.
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const k = Math.min(1, Math.max(0, t))
  const ch = (s: number) =>
    Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * k)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(16)}${ch(8)}${ch(0)}`
}

export type Look = { palette: Palette; key: string }

// Stable per-agent colours from the id. Heads wear a darker jacket and a red tie; the director a
// dark suit with a lime tie.
export function agentLook(id: string, role: 'worker' | 'head' | 'director' = 'worker'): Look {
  const h = hashId(id)
  const shirt = pick(SHIRTS, h)
  const hair = pick(HAIR, h >>> 5)
  const [skin, skinShade] = pick(SKIN, h >>> 9)
  const palette: Palette =
    role === 'director'
      ? { ...BASE, c: '#2c2f3e', d: '#1f2230', t: COLORS.lime, h: hair, s: skin, S: skinShade }
      : role === 'head'
        ? { ...BASE, c: shade(shirt, -0.45), d: shade(shirt, -0.6), t: COLORS.red, h: hair, s: skin, S: skinShade }
        : { ...BASE, c: shirt, d: shade(shirt, -0.25), t: shirt, h: hair, s: skin, S: skinShade }
  return { palette, key: `${role}:${shirt}:${hair}:${skin}` }
}

export function wallColor(roomId: string): string {
  return WALLS[roomId] ?? pick(WALLS_EXTRA, hashId(roomId))
}
