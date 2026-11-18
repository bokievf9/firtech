// Sprites of the pixel office as palette-indexed strings: one string per row, one character per
// pixel, `.` is transparent, every other character is a key of the palette (palette.ts). People
// face right; the scene mirrors them for facing left. All rows of a sprite must have the same
// width (parseSprite checks it). Pure module, covered by tests/pixel-office.test.mjs.

export type Sprite = {
  readonly w: number
  readonly h: number
  // Row-major palette keys, '' for transparent.
  readonly px: readonly string[]
}

export function parseSprite(rows: readonly string[]): Sprite {
  if (!rows.length) throw new Error('empty sprite')
  const w = rows[0]!.length
  const px: string[] = []
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`sprite row ${y} is ${row.length} wide, expected ${w}`)
    for (const ch of row) px.push(ch === '.' ? '' : ch)
  })
  return { w, h: rows.length, px }
}

// People: 12 x 16 standing, 12 x 14 sitting. Feet on the last row.
const HEAD = [
  '....kkkk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '..khhhssek..',
  '..khhsssSk..',
  '...kssssk...',
  '....kcck....',
]

const RAW = {
  stand: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctccdk.',
    '..kdcctccdk.',
    '..kscccccsk.',
    '...kppppk...',
    '...kpkkpk...',
    '...kpk.kpk..',
    '...kbk.kbk..',
    '...kkk.kkk..',
  ],
  hand: [
    '..........ks',
    '....kkkk..ks',
    '...khhhhk.kd',
    '..khhhhhhkkd',
    '..khhhssekd.',
    '..khhsssSkd.',
    '...kssssk.d.',
    '...kcctcckd.',
    '..kdcctccd..',
    '..kdcctcck..',
    '..ksccccck..',
    '...kppppk...',
    '...kpkkpk...',
    '...kpk.kpk..',
    '...kbk.kbk..',
    '...kkk.kkk..',
  ],
  walkA: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctcck..',
    '...kdctcdk..',
    '...ksccsck..',
    '...kppppk...',
    '..kpk..kpk..',
    '.kpk....kpk.',
    '.kbk....kbk.',
    '.kkk....kkk.',
  ],
  walkB: [
    ...HEAD,
    '...kcctcck..',
    '...kdctcck..',
    '...kdctcck..',
    '...ksccsck..',
    '...kppppk...',
    '....kppk....',
    '....kpkp....',
    '....kbkb....',
    '....kkkk....',
  ],
  coffee: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctccdk.',
    '..kdcctcdwwk',
    '..kscccckwwk',
    '...kppppkWk.',
    '...kpkkpk...',
    '...kpk.kpk..',
    '...kbk.kbk..',
    '...kkk.kkk..',
  ],
  sit: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctccdk.',
    '..kdcctcck..',
    '..kcccdddssk',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  typeA: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctcddsk',
    '..kdcctcck..',
    '..kcccccck..',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  typeB: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctcck..',
    '..kdcctcddsk',
    '..kcccccck..',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  sleep: [
    '............',
    '............',
    '.....kkkk...',
    '....khhhhk..',
    '...khhhhhhk.',
    '...khhhhhsk.',
    '....kcckssk.',
    '...kcctcccdk',
    '..kdcctcddsk',
    '..kdcctcck..',
    '..kcccccck..',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  // Office chair seen from the side, drawn behind a sitting person.
  chair: [
    '.kk.....',
    'kuuk....',
    'kuuk....',
    'kuuk....',
    'kuuk....',
    'kuukkkkk',
    'kuuuuuuk',
    '.kkkkkk.',
    '...kk...',
    '...kk...',
    '..kMMk..',
    '.k.kk.k.',
  ],
  // iMac: frame `m`, screen `g` (the scene paints the live screen over it), stand `M`.
  imac: [
    'kkkkkkkkkk',
    'kmmmmmmmmk',
    'kmggggggmk',
    'kmggggggmk',
    'kmggggggmk',
    'kmggggggmk',
    'kmmmmmmmmk',
    'kkkkMMkkkk',
    '....MM....',
    '...kMMk...',
  ],
  plant: [
    '..n.N..',
    '.nNn.n.',
    'nNnNnNn',
    '.nNnNn.',
    'NnNnNnN',
    '.NnNnN.',
    '..kqk..',
    '.kqqqk.',
    '.kqqqk.',
    '.kqqqk.',
    '..kkk..',
  ],
  coffeeMachine: [
    'kkkkkkkkkk',
    'kMMMMMMMMk',
    'kMrkkkkyMk',
    'kMMMMMMMMk',
    'kMk....kMk',
    'kMk....kMk',
    'kMk.ww.kMk',
    'kMk.wW.kMk',
    'kMkkkkkkMk',
    'kMMMMMMMMk',
    'kMMMMMMMMk',
    'kMMMMMMMMk',
    'kMMMMMMMMk',
    'kkkkkkkkkk',
  ],
  cooler: [
    '.kkkk.',
    'k9999k',
    'k9999k',
    'k9999k',
    '.kkkk.',
    'kwwwwk',
    'kwrwWk',
    'kwwwwk',
    'kwwwwk',
    'kwwwwk',
    'kwwwwk',
    'kkkkkk',
  ],
} as const satisfies Record<string, readonly string[]>

export type SpriteName = keyof typeof RAW

export const SPRITES: Readonly<Record<SpriteName, Sprite>> = Object.fromEntries(
  Object.entries(RAW).map(([name, rows]) => [name, parseSprite(rows)]),
) as Record<SpriteName, Sprite>

export const PERSON_W = 12
export const STAND_H = 16
export const SIT_H = 14
