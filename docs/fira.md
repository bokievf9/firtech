# Fira (Фира): the brand mascot, concept stage (2026-11-22)

Fira is the lime dot of the `fir.tech` logo come alive. Not a tree, not a robot. Character: cute and
soft, a female voice later. Built in code (React Three Fiber, procedural geometry, no assets) so the
agents can animate her. A glTF model comes later; this stage is three concept variants for the owner
to pick one. Screenshots and loops of this stage: the session scratchpad `shots/fira/` (36 PNGs
`fira-<a|b|c>-<emotion>-<light|dark>.png` at 800x800, three 4 s WebM loops `fira-<v>-loop.webm`).

## Character sheet (same rig, three design languages)
- **A «Капля»**: calm and bouncy. A soft rounded drop with two big round eyes with sparkles, small
  nub arms and a tiny glowing antenna dot that jiggles on its own spring.
- **B «Светлячок»**: curious and light. A translucent sphere with a glowing core, oval eyes and two
  soft rounded ears that perk up, droop and tilt toward the pointer.
- **C «Пушинка»**: the softest. A slightly fluffy sphere (noise displacement, cream rim), eyes as
  happy arches, a blush, a small tuft on top.

Common: body lime (`--color-accent`), eyes and mouth dark green (`--color-accent-ink`), sparkles and
inner parts cream (`--color-paper`), blush a soft coral (the only colour outside the tokens). Round
shapes only, large eyes low on the face, nothing sharp, no screws, panels or antenna on B and C.

## Use
```tsx
import { Fira } from '@/components/fira/fira'
<Fira variant="a" emotion="happy" size={240} lookAt mouth={amp} />
```
Props: `variant` `'a'|'b'|'c'`; `emotion` `'idle'|'thinking'|'happy'|'talking'|'point'|'sleep'`; `size`
(square px); `lookAt` (eyes and head follow the pointer, limited); `mouth` 0..1 (lip-sync, any emotion;
without it `talking` uses a synthetic envelope); `theme` (`light|dark` forces the table in
`lib/fira/palette.ts`, default reads the CSS variables live and follows `<html data-theme>`); `clock`
(fixed time for stills); `label` (accessible name, else decorative).

Delivery: `<Canvas>` is a lazy chunk (`next/dynamic`, `ssr: false`), `dpr` capped at 1.5, drawing
stops when the figure is off screen (IntersectionObserver) or the tab is hidden (`frameloop` never).
The 2D SVG (`fira-fallback.tsx`, tokens as CSS variables) is the server HTML, the placeholder until
the first frame, and the permanent face without WebGL or under `prefers-reduced-motion`.

Lab (hidden, noindex, not in sitemap or `localePages`): `/ru/fira-lab`. Three columns, emotion
switcher, pointer toggle, size slider, FPS counter (dev only); theme is the site switch in the header.
Capture mode for stills and loops: `?solo=a&emotion=happy&size=800&clock=0.48` or
`?solo=a&size=620&seq=idle:1.6,happy:1.4,thinking:1.6` (the loop starts after the first frame).

## Rig
One rig, files: `src/lib/fira/pose.ts` (pure maths, tested), `palette.ts`, `mouth.ts`;
`src/components/fira/fira-kit.ts` (geometry per variant), `materials.ts` (three small shaders),
`fira-scene.tsx` (the rig and the frame loop), `fira.tsx`, `fira-fallback.tsx`, `fira-lab.tsx`.
- Hierarchy: `root` (ground pivot: lean, hop) > `squash` (scale, volume kept: width and depth
  `1/sqrt(height)`) > `head` (pitch, yaw, roll) > body, eyes, mouth, blush, ears or antenna; arms and
  the three «z» sit beside the head.
- Every emotion is a table of targets (`targets` in `pose.ts`); 19 channels (pitch, roll, lean,
  squash, eye open, arches, smile, blush, arm, cheer, look x/y, glow, ears, ear split, breath, hop,
  zzz, pointer weight) each chase their target on a damped spring (`feel` sets stiffness and bounce,
  the squash spring is jelly: zeta 0.42). Changing emotion kicks the squash spring (a small pop).
- Time-based layers on top: breathing (rate per emotion), blink every 3 to 6 s (0.18 s), the happy
  hop (1.1 s: crouch, stretch, landing squash), antenna secondary spring, «z» rising in turn, an idle sway.
- Eyes and blush are SDF decals on the surface (anti-aliased): disc or oval, lid, arches, sparkles.
  The mouth is a capsule scaled by `mouth` plus a torus-arc smile that fades out as it opens.
- Pointer: window `pointermove`, offset from the figure's centre in figure sizes, clamped to a box
  (`clampLook`), kept in refs (no React state), weight per emotion (0 asleep).
- Shaders: Soft (half-lambert, green-leaning shade, rim, optional fluff noise), Eye, Blob (glow).
  They write sRGB and skip tone mapping so the lime stays lime.

## Emotions
| emotion | motion |
| --- | --- |
| idle | breathing, blink, slow sway, pointer follow |
| thinking | head tilts and looks up, eyes up-left, glow pulses slowly, one ear up (B), pointer weight 0.2 |
| happy | hop with squash and stretch, eyes arched, wide smile, blush, both arms up with a wiggle, ears perk |
| talking | mouth capsule follows `mouth` (or a synthetic envelope), small head bob, glow follows the voice |
| point | leans right, the right arm extends, eyes look along it |
| sleep | eyes closed, head droops, slow deep breathing, ears droop, three «z» made of capsules float up |

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
JS per frame is what the profiler can honestly say; frame rate here is the software rasteriser, not a
GPU, so treat it as a floor. Per frame: the rig's `useFrame` body 0.03 to 0.04 ms; all script time
(rig plus three's render call) 0.17 to 0.21 ms; all main-thread task time 0.35 to 0.42 ms. Every
variant is far under the 2 ms JS budget. Frame rate under software GL: A 60 fps, B 50 to 56 fps
(32 with the talking mouth in that run), C 23 to 37 fps (the displaced 20k-vertex body is the cost on
a CPU rasteriser; on a real GPU it is one cheap draw). Not measured: a real GPU, a phone.

## Not done at this stage
glTF model, real GPU and phone measurements, sound, the female voice, the chat avatar wiring,
exporting `Rig` for Remotion, `drei` (pinned for the glTF step, not imported yet).
