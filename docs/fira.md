# Fira (Фира): the brand mascot, round two (2026-11-22)

Fira is the lime dot of the `fir.tech` logo come alive. Not a tree, not a robot. Character: cute and
soft, a female voice later. Built in code (React Three Fiber, procedural geometry, no assets) so the
agents can animate her. A glTF model comes later. Round one (A, B, C: three spheres with faces) was
rejected by the owner as too generic. Round two is five new characters D to H on an improved rig,
designed from the reference study in `docs/fira-references.md` (14 mascots, the design rules). A to C
stay in code for comparison and show in the lab only with `?all=1`. Captures of round two live in the
session scratchpad `shots/fira2/`.

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
Eight: idle, thinking, happy, talking, point, sleep, wave, surprised.
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
