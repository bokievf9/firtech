import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { firaFace } from '@/lib/fira/face'
import type { FilmScene } from '@/lib/film'
import { FiraFallback3 } from '../fira/fira-fallback3'

// Fira's mark in a scene of the home film: the flat Fira (server SVG, so the first screen never waits
// for WebGL) and her line as a subtitle next to her. In film mode (FilmStage) one WebGL Fira lands on
// the mark of the active scene and the flat one fades out (CSS: html[data-film='on']).
const sizes = { sm: 'size-14', md: 'size-[4.5rem] lg:size-24', lg: 'size-28 lg:size-40' } as const

export function FiraMark({ scene, size = 'md', className }: { scene: FilmScene; size?: keyof typeof sizes; className?: string }) {
  return (
    <div data-film-mark={scene.id} className={cn('film-mark relative shrink-0', sizes[size], className)}>
      <FiraFallback3 variant={firaFace} emotion={scene.emotion} className="film-flat block size-full" />
    </div>
  )
}

export function FilmLine({ name, line, className }: { name: string; line: string; className?: string }) {
  return (
    <p data-film-line className={cn('film-line glass relative max-w-[48ch] rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-snug text-fg', className)}>
      <span className="mb-1 block font-mono text-[10px] tracking-[0.16em] text-accent-text uppercase">{name}</span>
      {line}
    </p>
  )
}

export function FilmCue({ scene, name, line, size = 'md', className }: { scene: FilmScene; name: string; line: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <div data-film-cue={scene.id} className={cn('flex items-end gap-3 md:gap-4', className)}>
      <FiraMark scene={scene} size={size} />
      <FilmLine name={name} line={line} className="mb-2" />
    </div>
  )
}

// One scene: the wrapper FilmStage watches, the cue on top (in the section's top padding) and the
// scene's sections. The hero carries its cue inside its own first screen, so it passes none here.
export function FilmSceneBlock({ scene, cue, children }: { scene: FilmScene; cue?: ReactNode; children: ReactNode }) {
  return (
    <div data-film-scene={scene.id} data-emotion={scene.emotion} className="film-scene relative">
      {cue ? (
        <div className="film-cue-row relative z-10 mx-auto max-w-7xl px-4 md:px-8 -mb-[calc(var(--spacing-section)-2.5rem)]">
          {cue}
        </div>
      ) : null}
      {children}
    </div>
  )
}
