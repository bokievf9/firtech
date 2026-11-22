import type { CSSProperties } from 'react'
import { accessoriesFor } from '@/lib/fira/contexts'
import { firaFace } from '@/lib/fira/face'
import type { Emotion } from '@/lib/fira/pose'
import { FiraFallback7 } from './fira-fallback7'

// The site's flat Fira: the round-eight turtle as plain SVG (server HTML, no WebGL, no client code). `context`
// picks her accessories (`accessoriesFor`); `morph` keeps all three in the markup so a changing context slides
// them in and out (used by the docked guide only).
export function FiraFlat({ emotion = 'idle', context, className, style, morph = false }: { emotion?: Emotion; context?: string; className?: string; style?: CSSProperties; morph?: boolean }) {
  return <FiraFallback7 variant={firaFace} emotion={emotion} acc={context === undefined ? undefined : accessoriesFor(context)} morph={morph} className={className} style={style} />
}
