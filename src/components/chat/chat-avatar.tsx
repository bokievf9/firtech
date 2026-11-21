import type { ComponentType } from 'react'
import { FiraFallback } from '../fira/fira-fallback'

// The header avatar of the receptionist. It is a slot: the panel takes any component with these
// props (`avatar` prop of ChatPanel), so a 3D Fira can replace the flat one later. The default is
// the 2D Fira (variant A, plain SVG: no WebGL and no three.js in the widget), talking while a reply
// is loading and idle otherwise.
export type ChatAvatarProps = { talking: boolean; size?: number }
export type ChatAvatarComponent = ComponentType<ChatAvatarProps>

export function ChatAvatar({ talking, size = 28 }: ChatAvatarProps) {
  return (
    <FiraFallback
      variant="a"
      emotion={talking ? 'talking' : 'idle'}
      style={{ width: size, height: size }}
      className="block"
    />
  )
}
