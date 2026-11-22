// Round seven (2026-11-23): the owner's reference art (docs/fira-ref/) as numbers. One rig, four variants
// A base, B headphones, C glasses, D laptop + glasses. Pure maths and tables, free of three.js, so node
// tests cover them. Measured on ref-hero-glasses.jpg (1080 px): head 433 x 355 px of a 825 px figure.
import { emotions, type Emotion } from './pose'
import type { T3 } from './pose3'
import { targets6 } from './turtle6'

export const turtles7 = ['a', 'b', 'c', 'd'] as const
export type Turtle7 = (typeof turtles7)[number]
export const isTurtle7 = (v: unknown): v is Turtle7 => typeof v === 'string' && (turtles7 as readonly string[]).includes(v)

export type Detail7 = {
  name: string
  sheet: string // the card title in ref-accessories.jpg
  caption: string
  glasses: boolean
  headphones: boolean
  laptop: boolean
  belly: true // cream plastron with 2 x 3 soft segments (the reference restores the belly)
  outline: true // thin dark toon outline on every shape
  toes: 3
  tail: true
  blush: true
  ring: boolean // lime glowing ring on each headphone cup
}
const common = { belly: true, outline: true, toes: 3, tail: true, blush: true } as const
export const detail7: Record<Turtle7, Detail7> = {
  a: { name: 'A «Базовая»', sheet: 'Базовая', caption: 'Без аксессуаров: лаймовое тело, кремовое брюшко, бирюзовый панцирь, тонкий тёмный контур, полуприкрытые глаза.', glasses: false, headphones: false, laptop: false, ring: false, ...common },
  b: { name: 'B «Наушники»', sheet: 'Наушники', caption: 'Тонкая дужка над головой, круглые чашки с лаймовым светящимся кольцом. На «слушает» в тёмной теме над ней взлетают ноты.', glasses: false, headphones: true, laptop: false, ring: true, ...common },
  c: { name: 'C «Очки»', sheet: 'Очки', caption: 'Круглые очки в тонкой тёмной оправе. Когда она думает, блики на стёклах вспыхивают, а рука поднимается к голове.', glasses: true, headphones: false, laptop: false, ring: false, ...common },
  d: { name: 'D «Ноутбук + очки»', sheet: 'Ноутбук + очки', caption: 'Очки и ноутбук перед собой: тёмная крышка, на ней лаймовый логотип. Обе руки держат его за верхние края.', glasses: true, headphones: false, laptop: true, ring: false, ...common },
}

// ---- Rig (scene units, feet on y = 0, she faces +z). Pixel measures on the hero art * 0.00315 ----
export const rig7 = {
  head: { rx: 0.68, ry: 0.56, rz: 0.52, y: 2.04 },
  body: { rx: 0.62, ry: 0.72, rz: 0.46, y: 0.88 },
  shell: { rx: 0.86, ry: 0.8, rz: 0.18, y: 1.06, z: -0.55, tilt: -0.05 },
  plastron: { rx: 0.49, ry: 0.59, rz: 0.14, y: 0.9, z: 0.36, cols: 2, rows: 3 },
  foot: { x: 0.34, y: 0.14, rx: 0.27, ry: 0.15, rz: 0.34 },
  arm: { x: 0.46, y: 1.38, len: 0.62, r: 0.115 },
  tail: { x: 0.5, y: 0.3, z: -0.15 },
}
export const ratios7 = () => {
  const { head, body, shell } = rig7
  const total = head.y + head.ry
  return {
    total,
    headH: head.ry * 2,
    headW: head.rx * 2,
    headToTotal: (head.ry * 2) / total,
    headWToBodyW: head.rx / body.rx,
    headAspect: head.rx / head.ry, // a wide, flattened dome
    shellDepthToBodyW: (shell.rz * 2) / (body.rx * 2),
    shellWidthToBody: shell.rx / body.rx, // the shell shows on both sides of the body
    shellOverlap: shell.z + shell.rz + body.rz, // the shell touches the back, no gap
  }
}

// ---- Emotions of the owner's sheet (ref-emotions.jpg) ----
export const sheetName7: Record<Emotion, string> = {
  idle: 'Чилл', thinking: 'Всезнайка', happy: 'Радость', surprised: 'Удивление', sorry: 'Скепсис', listening: 'Довольная',
  talking: 'Говорит', wave: 'Машет', point: 'Показывает', sleep: 'Спит',
}
export const sheetOrder7: Emotion[] = ['idle', 'thinking', 'happy', 'surprised', 'sorry', 'listening']
const tw: Partial<Record<Emotion, Partial<T3>>> = {
  idle: { lidTop: 0.4, slant: 0.2, lidBot: 0.04, smile: 0.5, browY: 0.12, browTilt: -0.05, asym: 0.05, eyeH: 1.05, pointer: 1 },
  thinking: { head: -0.04, headRoll: -0.04, lean: 0, roll: 0, lidTop: 0.36, slant: 0.05, browY: 0.55, browTilt: -0.25, asym: 0.6, smile: 0.3, lookX: -0.3, lookY: 0.3, lidBot: 0.06 },
  happy: { lidTop: 0, lidBot: 0.5, bend: 1, smile: 1, mouthW: 1.2, browY: 0.5 },
  surprised: { lidTop: 0, lidBot: 0, eyeH: 1.5, eyeW: 1.15, mouthO: 0.75, browY: 1.2, smile: 0 },
  sorry: { lidTop: 0.5, lidBot: 0.05, asym: 0.85, browTilt: -0.45, browY: 0.3, smile: -0.05, mouthW: 0.75, slant: 0.25 },
  listening: { lidTop: 0.2, slant: 0.05, lidBot: 0.1, smile: 0.75, browY: 0.3, eyeH: 1.02 },
  talking: { lidTop: 0.2, slant: 0.05, smile: 0.5 },
  wave: { lidTop: 0, lidBot: 0.5, bend: 1, smile: 0.9 },
}
export const targets7: Record<Emotion, T3> = Object.fromEntries(emotions.map((e) => [e, { ...targets6[e], ...tw[e] }])) as Record<Emotion, T3>

export const EYE_W7 = 0.085
export const EYE_H7 = 0.12
export const eyeShare7 = (maxEyeH: number) => (2 * EYE_H7 * maxEyeH) / 1.0

// Laptop (D) is always held up in front; the logo lid faces the viewer.
export const laptopHeld7 = (v: Turtle7) => detail7[v].laptop
// Notes rise from the headphones on `listening`, dark theme only (as in the video frames).
export const notesOn7 = (v: Turtle7, emotion: Emotion, dark: boolean) => detail7[v].headphones && emotion === 'listening' && dark
export const NOTE_PERIOD = 3.6
export function noteState7(i: number, t: number): { x: number; y: number; a: number } {
  const u = (((t + i * (NOTE_PERIOD / 3)) % NOTE_PERIOD) + NOTE_PERIOD) % NOTE_PERIOD / NOTE_PERIOD
  return { x: (i - 1) * 0.55 + Math.sin(u * 6 + i) * 0.1, y: u, a: Math.min(1, u * 5) * Math.min(1, (1 - u) * 3) }
}
