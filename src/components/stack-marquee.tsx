import {
  siClaude,
  siDocker,
  siFigma,
  siFlutter,
  siGooglegemini,
  siGooglesheets,
  siInstagram,
  siN8n,
  siNextdotjs,
  siNodedotjs,
  siPostgresql,
  siPython,
  siReact,
  siStripe,
  siSupabase,
  siSwift,
  siTelegram,
  siTypescript,
  siWhatsapp,
  type SimpleIcon,
} from 'simple-icons'
import type { Dict } from '@/content'

// Messengers and tools first (what an owner recognises), then the technology we build on.
const icons: SimpleIcon[] = [
  siTelegram,
  siWhatsapp,
  siInstagram,
  siGooglesheets,
  siStripe,
  siClaude,
  siGooglegemini,
  siN8n,
  siReact,
  siNextdotjs,
  siTypescript,
  siNodedotjs,
  siPython,
  siFlutter,
  siSwift,
  siPostgresql,
  siSupabase,
  siDocker,
  siFigma,
]

// Logo strip under the hero. Pure CSS animation (globals.css), no script; pauses on hover.
export function StackMarquee({ dict }: { dict: Dict }) {
  return (
    <section aria-label={dict.stack.label} className="border-y border-line bg-surface/30 py-10">
      <p className="mx-auto max-w-7xl px-4 text-center text-sm text-faint md:px-8">
        {dict.stack.label}
      </p>
      <div className="marquee marquee-mask mt-8 overflow-hidden">
        <ul className="marquee-track flex w-max items-center">
          {[...icons, ...icons].map((icon, i) => (
            <li
              key={`${icon.slug}-${i}`}
              aria-hidden={i >= icons.length}
              className="flex items-center gap-3 px-7 text-muted transition-colors duration-300 hover:text-fg md:px-9"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-7 fill-current"
                role="img"
                aria-label={icon.title}
              >
                <path d={icon.path} />
              </svg>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
