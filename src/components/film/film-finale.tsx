import { ArrowRight, PhoneCall, TelegramLogo } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { Dict } from '@/content'
import { buttonClass, buttonStyles, cn } from '@/lib/cn'
import type { FilmScene } from '@/lib/film'
import type { Locale } from '@/lib/i18n'
import { telegramUrl } from '@/lib/site'
import { ChatOpenButton } from '../chat/chat-open-button'
import { displayH2, sectionTitle } from '../home-v5'
import { FiraMark, FilmLine } from './film-cue'

// The last scene of the home film: Fira sees the visitor off with the three ways forward (build a
// project, arrange a call through the chat, Telegram); the FAQ follows right under it.
export function FilmFinale({ scene, dict, locale }: { scene: FilmScene; dict: Dict; locale: Locale }) {
  const f = dict.film
  return (
    <div data-film-cue={scene.id} data-film-finale className="flex flex-col gap-6 pb-10 md:flex-row md:items-end md:gap-8">
      <FiraMark scene={scene} size="lg" />
      <div className="min-w-0">
        <h2 className={displayH2}>{sectionTitle(f.finale.title)}</h2>
        <FilmLine name={f.name} line={f.scenes.final} className="mt-5" />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/${locale}/builder`} data-cta="film_build" className={cn('group')}>
            {f.finale.build}
            <ArrowRight size={16} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <ChatOpenButton source="film_call" fallbackHref={`/${locale}#demo`} className={buttonStyles.secondary}>
            <PhoneCall size={18} aria-hidden="true" className="text-accent-text" />
            {f.finale.call}
          </ChatOpenButton>
          {telegramUrl ? (
            <a href={telegramUrl} data-place="film_final" className={buttonStyles.secondary}>
              <TelegramLogo size={18} aria-hidden="true" className="text-accent-text" />
              {f.finale.telegram}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
