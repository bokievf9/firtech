# Fira (Фира): the brand mascot, round three (2026-11-22)

Fira is the lime dot of the `fir.tech` logo come alive. Not a tree, not a robot. Character: cute and
soft, a female voice later. Built in code (React Three Fiber, procedural geometry, no assets) so the
agents can animate her. A glTF model comes later. Round one (A, B, C: three spheres with faces) was
rejected by the owner as too generic. Round two is five new characters D to H on an improved rig,
designed from the reference study in `docs/fira-references.md` (14 mascots, the design rules). A to C
stay in code for comparison and show in the lab only with `?all=1`. Captures of round two live in the
session scratchpad `shots/fira2/`.

## Раунд 3: «взрослая милота» (I до M)
Владелец отклонил D до H: «слишком мультяшно, все одинаковые, выглядят как дети, эмоции не различаются».
Раунд 3: пять разных систем лица и силуэтов, спокойные и взрослые, милые формой, мягкостью, таймингом и
взглядом. Разбор референсов и правила: `docs/fira-references.md`. I до M стоят в лаборатории по умолчанию, и
`Fira` по умолчанию рисует `i`; раунды 1 и 2 открываются с `?all=1`. Снимки: `~/Desktop/fira-concepts-3/`.

- **I «Визор»** (семья EVE): гладкая галька 1 : 1.6 парит над полом, тёмный визор обнимает форму, глаза из
  лаймового света внутри визора. Рта нет. Говорит = огни пульсируют с `mouth`.
- **J «Око»** (семья Jibo): точка логотипа стала единственным глазом в графитовой линзе, у линзы светится
  ободок. Кремовая база стоит на месте, стебель и голова на шарнире наклоняются. Форма зрачка: круг, кольцо
  (слушает), полукольцо (говорит), ∩ полумесяц (рада), прищур (думает), точка (извиняется), линия (спит).
- **K «Экран»** (семья Vector): мягкий квадрат толщиной с блокнот, матовый тёмный экран, два тонких
  скруглённых глаза, антенна с лаймовой точкой на мягкой вторичной пружине. Говорит = глаза покачиваются.
- **L «Силуэт»** (семья Baymax и лампы): лаймовая голова на стройном кремовом теле (1 : 1.76), графитовый
  воротник, две точки и тонкая линия рта. Играет осанкой: наклон вперёд (слушает), взгляд вверх (думает),
  поклон (извиняется), подъём (удивлена), медленное покачивание (покой). Рука вырастает только в
  «показывает» и «машет».
- **M «Знак»** (бренд, 2.5D): сама точка логотипа как диск-линза с мягким краем, парит. Лицо: щёлочки,
  отдельные брови, тонкий рот; эмоции через угол бровей, длину щёлочек, изгиб рта, 3D-наклон и дыхание
  масштабом. Плоская версия годится для фавиконки и аватара 32 px.

### Правила (из брифа, проверяются тестами или числами)
1. Глаза не больше 12% высоты лица в самой крупной эмоции: I 11.4%, J 11.9%, K 11.2%, L 11.5%, M 9.2%
   (`eyeShare` в `pose3.ts`). Голова к телу от 1 : 1 до 1 : 2 (J 1 : 1.1, L 1 : 1.76; I, K, M цельные).
2. Матовая керамика (`clayMaterial` с `specPow` 16 до 30, слабый широкий блик, почти без полосы SSS), три
   цвета: лайм, графит, кремовый. Без румянца, зубов, языка, бликов-искорок, шапок, ушей, хвостов.
3. Дыхание 3.3 до 7.7 с (покой 4.5 с), моргание каждые 3 до 6 с, каждое четвёртое двойное (`blink3`),
   голова и взгляд к курсору, пружины жёсткостью 30 до 120 без желе; быстрее только реакция «удивлена»
   (`REACT`). Reduced motion: SVG без движения.
4. Каждая эмоция отличается от покоя минимум тремя группами каналов (форма глаз, угол века или брови,
   осанка, свет, темп), любые две эмоции между собой минимум двумя (`distinctGroups`, тест).

### Матрица каналов (общие цели `targets3`; «группы» = сколько групп из пяти отличается от покоя)
| эмоция | eyeW | eyeH | eyeY | lidTop | lidBot | bend | slant | lean | roll | head | lift | glow | warm | smile | browTilt | темп, с | группы |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| idle | 1 | 1 | 0 | 0.12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0 | 0.15 | 0 | 4.5 |  |
| listening | 0.94 | 1.12 | 0.12 | 0 | 0 | 0 | 0 | 0.12 | 0.1 | 0.06 | 0 | 0.78 | 0.35 | 0.3 | 0 | 4.2 | 5 |
| thinking | 0.88 | 1 | 0 | 0.3 | 0 | 0 | -0.25 | -0.04 | -0.12 | -0.2 | 0 | 0.62 | -0.45 | 0 | -0.35 | 5.0 | 5 |
| happy | 1 | 1.05 | 0.2 | 0 | 0.52 | 1 | 0 | -0.1 | 0 | 0 | 0.02 | 0.95 | 0.65 | 0.9 | 0.15 | 3.7 | 5 |
| talking | 1 | 1.02 | 0 | 0.05 | 0 | 0 | 0 | 0.05 | 0.04 | 0 | 0 | 0.72 | 0.2 | 0.25 | 0 | 4.0 | 4 |
| surprised | 1.12 | 1.32 | 0.18 | 0 | 0 | 0 | 0 | -0.08 | 0 | -0.08 | 0.05 | 1 | 0.05 | 0 | 0 | 3.3 | 5 |
| sorry | 1 | 0.72 | -0.35 | 0.3 | 0 | 0 | 0.75 | 0.2 | 0.07 | 0.24 | -0.02 | 0.24 | -0.7 | -0.55 | 0.8 | 5.6 | 5 |
| sleep | 0.85 | 0.1 | -0.25 | 0.55 | 0 | 0 | 0 | 0.12 | 0.1 | 0.26 | -0.02 | 0.14 | -0.35 | 0.05 | 0 | 7.7 | 5 |
| point | 1.06 | 1 | 0 | 0.04 | 0 | 0 | -0.12 | 0.06 | -0.09 | 0 | 0 | 0.74 | 0.15 | 0.35 | -0.15 | 4.5 | 4 |
| wave | 1 | 1 | 0.12 | 0 | 0.3 | 0.65 | 0 | -0.03 | 0.05 | 0 | 0 | 0.85 | 0.45 | 0.65 | 0 | 4.0 | 5 |

Поправки по вариантам (`override3`): у J кольцо в «слушает», полукольцо в «говорит», точка в «извиняется»,
прищур глубже в «думает»; у L голова выше в «думает» и наклон сильнее в «слушает»; у K «извиняется» мягче
и ярче, у M домик глаз мягче.

Как каналы выглядят у каждого варианта:

| эмоция | I «Визор» | J «Око» | K «Экран» | L «Силуэт» | M «Знак» |
| --- | --- | --- | --- | --- | --- |
| покой | два овальных огня, верх чуть срезан, медленное парение | круглый зрачок, ободок тлеет | два тонких бруска | точки, ровная линия, лёгкое покачивание | щёлочки, прямые брови, едва заметная улыбка |
| слушает | огни выше и крупнее, теплее, наклон вперёд и вбок | зрачок кольцом, голова склоняется | экран наклоняется к зрителю, глаза ярче | корпус к зрителю, голова набок, улыбка | брови вверх, щёлочки раскрыты, улыбка |
| думает | огни сужены, правый меньше, холоднее, взгляд вверх-влево | прищур, голова вверх и вбок | один глаз меньше, срез, наклон | голова запрокинута, взгляд вверх, короткий рот | брови врозь, правая щёлочка уже, рот короче |
| рада | огни ∩ дугами, отклон назад на 6°, тёплый свет | ∩ полумесяц, яркий ободок | ∩ дуги, антенна ярче | глаза-дуги, широкая улыбка, отклон назад | ∩ щёлочки, широкая улыбка, брови вверх |
| говорит | огни пульсируют с голосом | полукольцо, пульсирует | глаза покачиваются с голосом | рот овалом по `mouth` | рот овалом по `mouth` |
| удивлена | огни крупные и круглые, подъём, быстрая реакция | зрачок больше, голова назад | глаза крупные, антенна ярче | рост вверх, маленькое «о» | брови высоко, круглые глаза, «о» |
| извиняется | огни тусклые, опущены, внешние края вниз, холодные, наклон вперёд | зрачок точкой, поклон головой | глаза тонкие домиком, тусклые | поклон, глаза домиком, рот вниз | брови домиком, рот вниз, диск наклонён |
| спит | огни гаснут до линии, медленное дыхание, «z» | линия, голова опущена | линии на экране | голова свешена, линия глаз | линии, «z» |
| показывает | поворот вправо, огни смотрят вправо | голова поворачивается, зрачок вправо | антенна гнётся вправо, взгляд вправо | вырастает тонкая рука | поворот диска, взгляд вправо |
| машет | покачивание из стороны в сторону, полу-дуги | покачивание, полу-дуги | покачивание, антенна догоняет | рука медленно машет | покачивание, полу-дуги, улыбка |

### Файлы и захват
`src/lib/fira/pose3.ts` (каналы, цели, темп, пружины, двойное моргание, правило 12%, оттенок света; без
three.js, под тестами), `src/components/fira/fira-kit3.ts` (геометрия, керамика, шейдер лица `glyph`: огни на
графите или графитовые черты на лайме, рисует прямо на поверхности визора, линзы, экрана или головы, так что
при повороте лицо остаётся на кривой), `fira-scene3.tsx` (один цикл кадра на пять фигур, отдельный lazy
chunk 18.6 KB, 7.1 KB gzip), `fira-fallback3.tsx` (плоский SVG из тех же целей: глаз = контур, обрезанный
веками). Лаборатория: новый режим «Ряд эмоций», захват `?row=i&size=160&clock=0.5` (все десять эмоций в
ряд), лист стикеров теперь 5 x 2 без «Кричит» (`?sheet=i&size=1100&clock=0.5`). Остальные параметры как
раньше: `?solo=`, `?spin=`, `?seq=`, `?size=`, `?clock=`.

Числа (этот Mac, headless Chromium, software GL, production build, 480 px, 6 с): `useFrame` 0.042 до
0.048 мс, весь скрипт 0.16 до 0.18 мс, все задачи главного потока 0.32 до 0.36 мс на кадр, 60 fps у всех
пяти (talking так же). Код Фиры целиком 174 KB (бюджет поднят до 220 KB).

Известные шероховатости: у J зрачок по правилу 12% мелкий, на 160 px его форму читать трудно, эмоцию несут
ободок, наклон головы и свечение; на переходе «рада → покой» у точек L на долю секунды виден надрез от
нижнего века; в SVG у J зрачок крошечный; K в профиль показывает гладкий торец без деталей.

## Round two: five characters (one rig)
- **D «Огонёк»**: bright and warm. A round body with tiny arms, a small head shaped like a flame
  (three tongues, the tip bends and flickers on a secondary spring) that glows toward the tip, where
  the logo dot burns as an ember with a halo. Big eyes with brows.
- **E «Зёрнышко»**: sleepy and kind. A seed body with a leaf tuft and a glowing bud between the
  leaves (the dot), half-closed lids by default, short legs; it waddles (body roll, feet lift in
  turn), more when happy.
- **F «Шарик-с-телом»**: a clay figurine. A big round head with round ears on a small pear body, hands
  and feet, cheeks; the dot is a lamp on the chest. Wave and point use the hands.
- **G «Каплюшка-кот»**: sly and affectionate. A drop with two soft pointed ears that twitch, a tail
  of ten segments that sways and curls into a hook when she is happy, the dot on the forehead.
- **H «Пузырёк»**: shy. A translucent shell (fresnel alpha, highlights) around a small solid core that
  wears the face; the shell squashes, the core counter-scales and lags on its own springs, the core
  is the dot.

Shared: body lime (`--color-accent`), face dark green (`--color-accent-ink`), belly and highlights
cream (`--color-paper`), leaves, ears, feet and tails a deeper green (lime pulled toward the ink),
blush coral (the only colour outside the tokens; also the tongue). Nothing sharp.

## Use
```tsx
import { Fira } from '@/components/fira/fira'
<Fira variant="f" emotion="happy" size={240} lookAt mouth={amp} />
```
Props: `variant` `'a'..'h'` (default `'d'`); `emotion` the eight above; `spin` (turntable, rad/s); `size`
(square px); `lookAt` (eyes and head follow the pointer, limited); `mouth` 0..1 (lip-sync, any emotion;
without it `talking` uses a synthetic envelope); `theme` (`light|dark` forces the table in
`lib/fira/palette.ts`, default reads the CSS variables live and follows `<html data-theme>`); `clock`
(fixed time for stills); `label` (accessible name, else decorative).

Delivery: `<Canvas>` is a lazy chunk (`next/dynamic`, `ssr: false`), `dpr` capped at 1.5, drawing
stops when the figure is off screen (IntersectionObserver) or the tab is hidden (`frameloop` never).
The 2D SVG (`fira-fallback.tsx`, tokens as CSS variables) is the server HTML, the placeholder until
the first frame, and the permanent face without WebGL or under `prefers-reduced-motion`.

Lab (hidden, noindex, not in sitemap or `localePages`): `/ru/fira-lab`. Five columns (D to H;
`?all=1` adds A to C), three modes: compare (emotion switcher with wave and surprised, pointer toggle,
size slider), sticker sheet (3 x 3 emotions of one character, pick the character), turntable (slow
rotation to judge the silhouette). FPS counter in dev only; theme is the site switch in the header.
Capture mode for stills and loops: `?solo=d&emotion=happy&size=800&clock=0.48`,
`?solo=d&size=620&seq=idle:1.6,happy:1.4,thinking:1.6` (the loop starts after the first frame),
`?solo=d&spin=1.26` (turntable), `?sheet=d&size=980&clock=0.5` (the sticker sheet).

## Rig
Files: `src/lib/fira/pose.ts` (pure maths, tested), `palette.ts`, `mouth.ts`; round two:
`fira-kit2.ts` (profiles, geometry, materials, per-variant face layout), `fira-face.tsx` (the face and
`driveFace`), `fira-chars.tsx` (D to H, one animator each), `fira-scene2.tsx` (the frame loop),
`materials.ts` (shaders); round one: `fira-kit.ts`, `fira-scene.tsx`. Shared: `fira.tsx`,
`fira-fallback.tsx`, `fira-lab.tsx`.
- Hierarchy (round two): `root` (ground pivot, scale to fit, lean, hop) > `turn` (the turntable) >
  `squash` (volume-keeping scale) > the character. Each character renders its own parts and registers
  one animator; the scene's single `useFrame` steps the springs, computes a shared context (squash,
  breath, pointer, lip-sync amplitude, head angles) and calls it, then drives the face.
- 30 channels (round one's 19 plus brows lift, tilt and split, lid and its tilt, wide eyes, grin,
  round mouth, wave, tail, waddle), each on a damped spring chasing the emotion's target (`targets`
  in `pose.ts`; `feel` sets stiffness and bounce, squash is jelly with zeta 0.42). Changing emotion
  kicks the squash spring.
- Time layers: breathing, blink every 3 to 6 s, the happy hop (1.1 s, lower than round one so she
  stays in frame), secondary springs (flame tip, leaves, bubble core, tail curl), ear twitch.
- Face (all variants): decals on the lathe profile of the body. Eye: SDF ellipse, dark iris with a
  lighter lower rim, two highlights, blink, arches when happy or asleep. Lid: a separate mesh with a
  body-coloured patch and a lash line, `lid` closes it from the top, `lidTilt` tilts it. Brow: a
  separate arc mesh per eye, lift, tilt (inner ends down is angry), `browSplit` raises the left one
  (thinking). Mouth: one SDF decal, a smile arc or an open shape with a tongue.
- Mouth shapes: `visemeAt(amp, phase)` gives five (closed, ee, oh, ah, big) and swaps oh and ah in
  the middle; `mouthShape` combines the emotion (smile, grin `D` shape, round `o`) with the voice, the
  more open one wins. Tested.
- Pointer: window `pointermove`, offset from the figure's centre clamped to a box (`clampLook`), kept
  in refs, weight per emotion (0 asleep).
- Materials (`clayMaterial`): matte clay. Three-point soft studio light (warm key with wrap, cool fill,
  back light that feeds the rim), a saturated yellow-green band at the terminator (fake subsurface
  scattering), darker underside, broad weak highlight, grain, optional tip gradient and bend (the
  flame), a fresnel alpha for the bubble shell. Contact shadow: two blobs under every figure. All
  shaders write sRGB and skip tone mapping so the lime stays lime.
- Turntable: `spin` (rad/s) rotates the figure; the lab's «Поворот» mode and `?spin=1.26`.

## Emotions
Ten since round three (listening and sorry added; rounds one and two show them as a tilt and a droop). Round two's table:
| emotion | motion |
| --- | --- |
| idle | breathing, blink, slow sway, pointer follow, a small waddle |
| thinking | head tilts, eyes up-left, one brow up, one lid lowered, glow pulses |
| happy | hop with squash and stretch, arched eyes, open grin, both arms up, ears perk, tail curls, waddles |
| talking | five mouth shapes follow `mouth` (or a synthetic envelope), small head bob, glow follows the voice |
| point | leans right, the right arm extends, eyes look along it |
| sleep | eyes closed, head droops, deep breathing, brows relax, ears droop, three «z» rise |
| wave | the right arm raised and waving, a small grin, glow up, tail wags |
| surprised | a pop (squash kick), wide eyes, brows up, round mouth, ears and tail up |

## Lip-sync
`useMouthFromAudio(audioEl)` in `src/lib/fira/mouth.ts` returns 0..1 from a WebAudio analyser on the
element (cached source node, resumes on play, about 30 updates a second). `ampFromBytes` (RMS with a
noise gate and gain) and `smoothAmp` (fast attack, slower release) are pure and tested. Intended use:
the chat avatar, `<Fira emotion="talking" mouth={useMouthFromAudio(el)} />`.

## Adding a glTF later
Keep the contract above (props, emotions, channels). Export the model with the same node names as the
rig groups (`root`, `squash`, `head`, `eyeL`, `eyeR`, `mouth`, `armL`, `armR`, plus morph targets for
`blink`, `smile`, `mouthOpen`) and load it with drei's `useGLTF` inside `Rig`; replace the kit meshes
with the loaded nodes and map `Pose` channels to bone rotations and morph influences in the same
`useFrame`. `pose.ts`, the lab, the SVG fallback and the lip-sync stay as they are.

## Remotion
Render the same scene in `@remotion/three` (`<ThreeCanvas>`): mount `Rig` with a `clock` taken from
`useCurrentFrame() / fps` (the `clock` prop already freezes blink and drives the hop and breathing
from time, so frames are deterministic), `lookAt` off, `mouth` from the voice track's amplitude per
frame (`ampFromBytes` over the decoded samples), `emotion` from the script's cue list. `Rig` is not
exported yet: export it from `fira-scene.tsx` when the first video needs it (one line).

## Numbers (this Mac, headless Chromium with software GL, production build, 480 px, 6 s each)
JS per frame is what the profiler can honestly say; frame rate here is the software rasteriser (CPU),
not a GPU, so treat it as a floor. Round two, idle, happy and talking alike: the rig's `useFrame`
body 0.03 to 0.04 ms; all script time (rig plus three's render call) 0.15 to 0.18 ms; all main-thread
task time 0.28 to 0.34 ms per frame. Every variant is far under the 2 ms JS budget. Frame rate under
software GL: E, F, H 60 fps, D 50 fps, G 44 fps (the tail is ten small spheres; before using a
low-poly sphere for small parts it ran 20 fps on the CPU rasteriser, on a GPU it is a few cheap
draws). Not measured: a real GPU, a phone.

## Not done at this stage
glTF model, real GPU and phone measurements, sound, the female voice, the chat avatar wiring (the
chat widget still shows the flat A), exporting `Rig` for Remotion, `drei` (pinned for the glTF step,
not imported yet), the owner's pick among D to H. Known rough edges: D has a visible collar line where
the flame head meets the body and its glow touches the top edge when it hops; the lid patch is flat
colour, so on E it shows as a slightly lighter shape; the SVG fallbacks are simpler than the 3D.

## Round five (2026-11-23): the standing turtle, four details on one rig
Owner's verdict on round four: standing, bipedal, cartoon-cute, soft limbs without joints, chill but a
responsible know-it-all, clear eyes and brows, a MEDIUM shell. One rig (`fira-scene5.tsx`, `fira-kit5.ts`,
pure parts in `src/lib/fira/turtle5.ts`), four variants that differ only by the signature detail
(`detail5` flags): R round glasses (lens highlight flashes while `thinking`, the hand adjusts them on
`listening`), S headphones on the neck (on `listening` one cup rides up to the ear with the hand), T shell
segments that glow like mood lamps (emotion plus the page context of `contexts.ts` tint one to three
of eleven scutes; the shell shader keeps an array of segment colours), U glasses plus headphones.
All four carry the logo's lime dot as a glowing pearl on the crown of the shell.
- Proportions (units, feet on y = 0): head ball 1.1 (r 0.55), body pear 1.36 high and 1.1 wide, shell
  ellipsoid 1.24 high and 1.4 wide sitting 0.5 behind the body and tilted back 0.5 rad. Head : body :
  shell heights = 1.1 : 1.36 : 1.24 (about 0.8 : 1 : 0.9), shell width 1.27 times the body, total height
  2.7, head 41% of it. `ratios5()` and the tests pin these ranges.
- Soft limbs: arms are a shoulder bulb plus a tapered capsule plus a mitten, legs a capsule plus a flat
  foot, all in the same matte clay as the body and overlapping it, so no seam shows; the arm reaches a
  target point in body space (wave, point, head, lens, cup) by aiming and stretching, hand un-stretched.
- Face: the round-three glyph (eyes, brows, mouth); eye half size 0.06 (one eye is 12 to 16% of the head,
  tested under 17%), brows tuned in `targets5` (sorry worried, thinking stern, surprised high); idle has
  half lids and a slight smile for the chill know-it-all look. Same ten emotions, same `mouth` lip-sync hook.
- Visible lamps: from the default three-quarter view only segments 2, 7 and 8 (and slivers of 0 and 3)
  face the camera, so the emotion tables spend 2 and 7 and the page context spends 8.
- SVG fallback per variant: `fira-fallback5.tsx`, front view, same eyes from the same targets, every part
  has `data-part` so tests see which detail is drawn.
- Lab: round five is the default at `/[locale]/fira-lab` (`?round=4` the round-four turtles, `?round=3`
  the faces). Views: overview R S T U with a caption under each, `?solo=r`, `?row=r`, `?sheet=1`, emotion
  row, page context, talk, spin, size; `?cap=1&clock=1` for stills. Still noindex, not in the sitemap.
- Budget: Fira code raised from 260 to 340 KB (now about 305 KB); round five itself is about 50 KB.
- Rough edges: the thinking pose is a straight arm to the head (no elbow), the pearl halo is pale on the
  light theme, the lamps of T are only partly visible in the default view (spin shows all).
