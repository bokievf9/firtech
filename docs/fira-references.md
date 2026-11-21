# Fira: reference study (2026-11-22, round 2)

Why this exists: the owner rejected round one (A drop, B glowing sphere, C fluffy sphere) as "plain
spheres with faces, too generic" and asked to look at how others do it. Below: 14 mascots and
character styles, what gives each its character, what Fira borrows and what she avoids. Sources are
web searches and fetched pages from 2026-11-22; claims that only fan or secondary sites support are
marked (secondary). Nothing here was verified by looking at brand files, only at the pages quoted.

## The references

| # | Reference | What gives it character | Borrow | Avoid |
| --- | --- | --- | --- | --- |
| 1 | **Duolingo, Duo and the world characters** (design.duolingo.com, blog.duolingo.com/world-character-visemes) | Every shape rounded, no points; about 15 shapes per illustration ("6 is too abstract, 30 too busy"); a small set of geometric eye styles, no plain ovals; 20+ mouth shapes (visemes), a different set per character so the mouth matches the personality; idle blinking, nods, brow moves | Few big rounded shapes; a viseme set designed for Fira (we use five); brows as the cheap way to show emotion; eyes as the main design decision | A cast of ten: we need one memorable face |
| 2 | **Mailchimp, Freddie** (Design Week, Creative Bloq on the 2018 Collins rebrand) | Simplified for any size: stronger silhouette, less detail, single colour; the wink and the hat survived the simplification | Test the silhouette first, in one colour, small; one cheeky signature (for Fira: the glowing dot) | Gags that need detail to read |
| 3 | **Discord, Clyde and Wumpus** (Discord blog, support article on the 2021 refresh) | Many circular drafts, a smiley, then a squarer form; freed from the chat bubble to stand and move; critics said the antennae became "shoulders" | Free the character from its container; an appendage must not read as something else | Antennae or ears that look like shoulders or hardware |
| 4 | **GitHub, Octocat / Mona** (cameronmcefee.com, brand.github.com) | A hybrid creature (cat plus octopus), a recognisable silhouette that also works as the flat "Invertocat"; costumes and poses carry the story | One simple hybrid idea per character (flame head, seed, cat drop); the silhouette must survive being flat | Many tentacles: more limbs than the rig can animate |
| 5 | **Headspace** (blakecrosley.com guide, Dribbble case study, Kombai page, mostly secondary) | Circles and ovals as primitives, generous radii, two dots and a line for a face, emotion by posture and colour; the 3D blob "Ebb" (secondary) | Posture as acting: lean, tilt, droop; restraint of face detail | Faces with no brows, which stalls on "worried" and "surprised" |
| 6 | **Anthropic, Clawd** (Stark Insider, fan projects, secondary) | A pixel crab with the simplest possible silhouette and a name; lives in the terminal | A tiny mascot can carry a brand if the silhouette is simple and named | Pixel style, crab claws: not our idea |
| 7 | **Notion Faces** (buck.co/work/notion-faces) | Modular hand-drawn features, "expression over likeness", accessories add personality | Features as separate parts (we split eye, lid, brow, mouth, cheeks) so emotions combine | Hand-drawn linework: Fira is 3D |
| 8 | **Slack illustration** (byalicelee.com, brand.slackhq.com) | Shapes derived from the logo, warm whimsical characters after Mary Blair, solid shapes by default | The logo's own shape generates the character: the dot of `fir.tech` | A separate illustration style per page |
| 9 | **Pixar and Disney appeal** (Cartoon Brew, Disney Research on character proportions, Psychology Today on baby schema) | Baby schema: big head, big round eyes set low and wide, round cheeks; forward-facing eyes are the link to the audience; too sugary and the audience turns sceptical | Eyes low and wide with two highlights; round cheeks; a little attitude (brows, half lids) so she is not cloying | Pure sweetness with no edge |
| 10 | **3D clay render trend** (CGTrader clay creatures, 80.lv Blender clay posts, Dribbble) | Matte surface, soft edges, soft studio light, handcrafted look | Matte clay shader, wrap light, a saturated terminator band that fakes subsurface scattering, faint grain | Glossy plastic and heavy reflections |
| 11 | **Spline and Framer cursor-follow mascots** (Contra case studies, Framer "Mochi", "Interactive 3D Pet") | Head and eyes track the cursor with physics; a soft figure that reacts | Pointer follow with limits (already in the rig), secondary motion | Following forever: she sleeps and ignores the pointer when asleep |
| 12 | **Telegram animated stickers and Telemoji** (core.telegram.org/stickers, Emojipedia) | One clear pose per sticker, about 20 to 30 KB Lottie each, 600+ animated emoji; read at chat size | A 3 x 3 sticker sheet is the test: each emotion readable at 64 px | Props and scenes: the pose must carry it |
| 13 | **Kirby** (Wikipedia, Retroware, Nintendo Life) | Iwata: a circle simple enough for anyone to draw; no complex face, so a small flush or a wide eye carries weight | Simple enough to sketch from memory; small face changes do a lot | A bare circle: that is exactly round one |
| 14 | **Pusheen and "puni" plush** (Tuts+ cute design, shapes.inc, secondary) | Low centre of gravity, very short plump limbs, small feet, almost no neck | Short nubs for arms and legs, a low heavy body (E, F, G) | Total limblessness: Fira must point and wave |

Not found in search: a first-party Notion illustration spec, an official Anthropic page on Clawd, any
Discord statement about a Wumpus redesign (only about Clyde). They are cited only for what the pages
say.

## Design rules for Fira (the brief for round two)

1. **Silhouette first.** Readable at 24 px in one flat colour: five different outlines (flame head
   on a ball, seed with leaves, big head on a small body, drop with ears and tail, bubble with a
   core). No sphere with a face. The only intentional circle is the bubble, and its core makes it
   asymmetric.
2. **Proportions are not a sphere.** Eye to head ratio about 0.55 (eyes are the biggest feature),
   eyes low and wide apart, head at least as wide as the body, limbs as short plump nubs.
3. **A face that can act.** Eyes with highlights and a lighter lower rim; an upper lid as a separate
   mesh that can tilt (sleepy, sceptical); brows as separate meshes (lift, tilt, one raised); cheeks;
   a mouth with five shapes (closed smile, ee, oh, ah, big) plus a grin and a round "o".
4. **Hands or nubs.** Every character can wave, point and cheer with its arms; F has hands, the others
   rounded nubs.
5. **Material.** Matte clay: wrap light from a warm key, a cool fill and a back light feeding a subtle
   rim; a saturated yellow-green band at the terminator (fake SSS); a darker underside; broad weak
   highlight; faint grain. Contact shadow under every figure. Never glossy plastic.
6. **One hue family.** Lime (`--color-accent`) body, cream (`--color-paper`) for belly and highlights,
   deep green (lime pulled toward `--color-accent-ink`) for leaves, ears, feet, tail; the face is the
   ink colour. The coral blush is the only colour outside the tokens (a mouth tongue uses it too).
7. **One signature detail: the glowing dot.** A light lime-cream core with a soft halo that pulses
   with the mood: at the flame tip (D), as the bud between the leaves (E), on the chest (F), on the
   forehead (G), as the core itself (H).
8. **Posture is acting.** Lean, tilt, droop, squash and stretch on every emotion change; secondary
   motion (flame tip, leaves, ears, tail, the bubble core lagging the shell).
9. **Budget.** dpr up to 1.5, JS per frame well under 2 ms, drawing stops off screen and in hidden
   tabs, the SVG fallback is complete for every variant and emotion.
