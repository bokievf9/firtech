import type { ComponentType } from 'react'
import { FiraFlat } from '../fira/fira-flat'

// The header avatar of the receptionist. It is a slot: the panel takes any component with these
// props (`avatar` prop of ChatPanel), so a 3D Fira can replace the flat one later. The default is
// the flat Fira with the site's face (`firaFace`, plain SVG: no WebGL and no three.js in the widget), in
// headphones (context `chat`), talking while a reply is loading and listening otherwise.
export type ChatAvatarProps = { talking: boolean; size?: number }
export type ChatAvatarComponent = ComponentType<ChatAvatarProps>

export function ChatAvatar({ talking, size = 28 }: ChatAvatarProps) {
  return (
    <FiraFlat
      context="chat"
      emotion={talking ? 'talking' : 'listening'}
      style={{ width: size, height: size }}
      className="block"
    />
  )
}
