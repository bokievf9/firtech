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

// `n` copies of one row (poles, panels).
function rows(n: number, row: string): string[] {
  return Array.from({ length: n }, () => row)
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
  // Reading at the desk: a red book held in front.
  read: [
    ...HEAD,
    '...kcctcck..',
    '..kdcctccdkr',
    '..kdcctcdsrw',
    '..kcccccdkrw',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  // Resting in the chair: eyes closed, hands off the keyboard.
  lean: [
    '....kkkk....',
    '...khhhhk...',
    '..khhhhhhk..',
    '..khhhsskk..',
    '..khhsssSk..',
    '...kssssk...',
    '....kcck....',
    '...kcctcck..',
    '..kdcctccdk.',
    '..kdcctcck..',
    '..kcccccck..',
    '..kppppppppk',
    '..kkkkkkkpk.',
    '........kbk.',
  ],
  // Standing stretch: both arms up.
  stretch: [
    '.ks......sk.',
    '.kd.kkkk.dk.',
    '.kdkhhhhkdk.',
    '..khhhhhhk..',
    '..khhhssek..',
    '...kssssk...',
    '....kcck....',
    '...kcctcck..',
    '...kcctcck..',
    '...kcctcck..',
    '...kcccck...',
    '...kppppk...',
    '...kpkkpk...',
    '...kpk.kpk..',
    '...kbk.kbk..',
    '...kkk.kkk..',
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
  // ---- Office v2 props (palette keys in palette.ts) ----
  ringLight: [
    '..www..',
    '.w...w.',
    'w.....w',
    'w..k..w',
    'w.....w',
    '.w...w.',
    '..www..',
    ...rows(11, '...M...'),
    '..MMM..',
    '.M.M.M.',
    'M..M..M',
    'M.....M',
  ],
  tripod: [
    '.kkkkk...',
    'kxxxxxkk.',
    'kxzzxxkBk',
    'kxxxxxkkk',
    '.kkkkk...',
    ...rows(10, '..MM.....'),
    '.M..M....',
    'M....M...',
    'M....M...',
  ],
  deskPhone: ['.kkk.', 'kzxzk', 'kkkkk'],
  headset: ['.kkk.', 'k...k', 'B...B', '..M..', '..M..', '..M..', '.MMM.'],
  miniRack: [
    'kkkkkkkkkk',
    ...Array.from({ length: 6 }, (_, i) => [i % 2 ? 'kxxxxxxxxk' : 'kzGzGzzzzk', 'kxxxxxxxxk', 'kzzzzzzzzk']).flat(),
    'kkkkkkkkkk',
  ],
  cabinet: [
    'kkkkkkkkk',
    ...Array.from({ length: 3 }, () => ['kmmmmmmmk', 'kmmMMMmmk', 'kmmmmmmmk', 'kmmmmmmmk', 'kMMMMMMMk', 'kkkkkkkkk']).flat(),
  ],
  printer: ['.kkkkkkk.', 'kmmmmmmmk', 'kmzzzzzmk', 'kmmmmmGmk', 'kkkkkkkkk'],
  safe: [
    'kkkkkkkkkk',
    'kxxxxxxxxk',
    'kxkkkkkkxk',
    'kxkMMMkkxk',
    'kxkMzMkMxk',
    'kxkMMMkMxk',
    'kxkkkkkkxk',
    'kxxxxxxxxk',
    'kkkkkkkkkk',
    '.k......k.',
  ],
  award: ['YYYYYY', 'YzzzzY', 'YzYYzY', 'YYYYYY', 'YzYYzY', 'YzzYzY', 'YzzzzY', 'YYYYYY'],
  bin: ['kkkkk', 'kMMMk', 'kMxMk', 'kMxMk', 'kMMMk', '.kkk.'],
  generator: [
    '..kkkkkkkkkkkkkk..',
    '.kxxxxxxxxxxxxxxk.',
    'kxxzzzzzzxxkkkkxxk',
    'kxzMzMzMzxxk..kxxk',
    'kxzzzzzzzxxk..kxxk',
    'kxzMzMzMzxxkkkkxxk',
    'kxzzzzzzzxxxxxxxxk',
    'kxzMzMzMzxxMMMMxxk',
    'kxzzzzzzzxxxxxxxxk',
    'kxxxxxxxxxxMMMMxxk',
    'kxxxxxxxxxxxxxxxxk',
    'kYYYYYYYYYYYYYYYYk',
    'kxxxxxxxxxxxxxxxxk',
    'kkkkkkkkkkkkkkkkkk',
    '.kk............kk.',
  ],
  box: ['kkkkkk', 'koOOok', 'kooook', 'kooook', 'kkkkkk'],
  // ---- Icons in bubbles and over visitors ----
  iconCheck: ['....G', '...G.', 'G.G..', '.G...'],
  iconMail: ['kkkkkkk', 'kwkwkwk', 'kwwkwwk', 'kwwwwwk', 'kkkkkkk'],
  iconThumb: ['.Yk..', '.Yk..', 'kYYYk', 'kYYYk', 'kYYk.'],
  iconGlobe: ['.BBB.', 'BwBwB', 'BBBBB', 'BwBwB', '.BBB.'],
  iconPlane: ['....T', '..TTT', 'TTTT.', '..TT.', '...T.'],
  bell: ['..k..', '.YYY.', '.YYY.', '.YYY.', 'YYYYY', '..k..'],
} as const satisfies Record<string, readonly string[]>

export type SpriteName = keyof typeof RAW

export const SPRITES: Readonly<Record<SpriteName, Sprite>> = Object.fromEntries(
  Object.entries(RAW).map(([name, rows]) => [name, parseSprite(rows)]),
) as Record<SpriteName, Sprite>

export const PERSON_W = 12
export const STAND_H = 16
export const SIT_H = 14
