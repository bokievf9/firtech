import type { KindId } from '../content/builder-catalog'
import type { ThemeId, ThemeMood } from './builder-ids'
import type { StyleDensity, StyleMood, StylePalette, StyleShape, StyleType } from './builder'

export { themeIds, themeMoods, type ThemeId, type ThemeMood } from './builder-ids'

// Themes by genre and niche (owner review 2026-11-22). A theme is a palette, a type pair, a shape, a
// density and a mockup mood (the five style axes) plus a motion preset: how sections appear (reveal),
// whether the hero background drifts (parallax), what buttons do (micro-interactions) and which hero
// the mockup draws. Each theme has three moods (calm, vivid, premium) that swap the axes and the
// motion. The palette and the fonts stay editable inside the theme («тонкая настройка»). A theme only
// restyles the mockup and never changes the price.

export type ThemeAxes = {
  palette: StylePalette
  type: StyleType
  shape: StyleShape
  density: StyleDensity
  mood: StyleMood
}
export type RevealKind = 'fade' | 'rise' | 'slide' | 'scale'
export type ParallaxKind = 'none' | 'soft' | 'deep'
export type MicroKind = 'lift' | 'press' | 'glow' | 'wiggle' | 'none'
export type HeroKind = 'photo' | 'split' | 'type' | 'grid' | 'cards' | 'search'
export type MotionPreset = {
  reveal: RevealKind
  parallax: ParallaxKind
  micro: MicroKind
  hero: HeroKind
  // Seconds of one reveal; calm themes are slower, vivid ones snappier.
  duration: number
}

type MoodDef = { axes: ThemeAxes; motion?: Partial<MotionPreset> }
type ThemeDef = { motion: MotionPreset; moods: Record<ThemeMood, MoodDef> }

const ax = (
  palette: StylePalette,
  type: StyleType,
  shape: StyleShape,
  density: StyleDensity,
  mood: StyleMood,
): ThemeAxes => ({ palette, type, shape, density, mood })

export const themes: Record<ThemeId, ThemeDef> = {
  clinic: {
    motion: { reveal: 'fade', parallax: 'soft', micro: 'lift', hero: 'split', duration: 0.6 },
    moods: {
      calm: { axes: ax('skylight', 'humanist', 'soft', 'airy', 'minimal') },
      vivid: {
        axes: ax('mintlight', 'rounded', 'pill', 'airy', 'playful'),
        motion: { reveal: 'rise', micro: 'wiggle', duration: 0.4 },
      },
      premium: {
        axes: ax('forest', 'humanist', 'soft', 'airy', 'premium'),
        motion: { parallax: 'deep', duration: 0.8 },
      },
    },
  },
  salon: {
    motion: { reveal: 'rise', parallax: 'soft', micro: 'lift', hero: 'photo', duration: 0.6 },
    moods: {
      calm: { axes: ax('blush', 'humanist', 'pill', 'airy', 'minimal') },
      vivid: {
        axes: ax('plum', 'rounded', 'pill', 'compact', 'bold'),
        motion: { reveal: 'scale', micro: 'glow', duration: 0.4 },
      },
      premium: {
        axes: ax('noir', 'serif', 'sharp', 'airy', 'premium'),
        motion: { reveal: 'fade', parallax: 'deep', duration: 0.9 },
      },
    },
  },
  coffee: {
    motion: { reveal: 'rise', parallax: 'none', micro: 'press', hero: 'photo', duration: 0.55 },
    moods: {
      calm: { axes: ax('latte', 'humanist', 'soft', 'compact', 'minimal') },
      vivid: {
        axes: ax('lemon', 'rounded', 'pill', 'airy', 'playful'),
        motion: { reveal: 'scale', parallax: 'soft', micro: 'wiggle', duration: 0.38 },
      },
      premium: {
        axes: ax('graphite', 'condensed', 'sharp', 'compact', 'premium'),
        motion: { reveal: 'fade', parallax: 'deep', micro: 'lift', duration: 0.8 },
      },
    },
  },
  shop: {
    motion: { reveal: 'rise', parallax: 'none', micro: 'lift', hero: 'cards', duration: 0.5 },
    moods: {
      calm: { axes: ax('paper', 'grotesk', 'soft', 'compact', 'minimal') },
      vivid: {
        axes: ax('blush', 'geometric', 'pill', 'compact', 'bold'),
        motion: { reveal: 'scale', micro: 'press', duration: 0.36 },
      },
      premium: {
        axes: ax('noir', 'grotesk', 'sharp', 'airy', 'premium'),
        motion: { reveal: 'fade', parallax: 'soft', duration: 0.8 },
      },
    },
  },
  legal: {
    motion: { reveal: 'fade', parallax: 'none', micro: 'none', hero: 'type', duration: 0.7 },
    moods: {
      calm: { axes: ax('paper', 'serif', 'sharp', 'airy', 'minimal') },
      vivid: {
        axes: ax('skylight', 'grotesk', 'soft', 'compact', 'bold'),
        motion: { reveal: 'slide', micro: 'lift', duration: 0.4 },
      },
      premium: {
        axes: ax('forest', 'serif', 'sharp', 'airy', 'premium'),
        motion: { parallax: 'soft', duration: 0.9 },
      },
    },
  },
  it: {
    motion: { reveal: 'slide', parallax: 'deep', micro: 'glow', hero: 'grid', duration: 0.45 },
    moods: {
      calm: { axes: ax('midnight', 'mono', 'soft', 'compact', 'minimal'), motion: { parallax: 'soft', duration: 0.6 } },
      vivid: {
        axes: ax('aurora', 'geometric', 'pill', 'compact', 'bold'),
        motion: { reveal: 'scale', duration: 0.35 },
      },
      premium: {
        axes: ax('graphite', 'grotesk', 'sharp', 'compact', 'premium'),
        motion: { reveal: 'fade', micro: 'lift', duration: 0.8 },
      },
    },
  },
  fitness: {
    motion: { reveal: 'slide', parallax: 'soft', micro: 'press', hero: 'type', duration: 0.45 },
    moods: {
      calm: { axes: ax('mintlight', 'grotesk', 'soft', 'airy', 'minimal'), motion: { reveal: 'rise', duration: 0.6 } },
      vivid: {
        axes: ax('ember', 'condensed', 'sharp', 'compact', 'bold'),
        motion: { parallax: 'deep', duration: 0.3 },
      },
      premium: {
        axes: ax('noir', 'condensed', 'sharp', 'airy', 'premium'),
        motion: { reveal: 'fade', micro: 'glow', duration: 0.8 },
      },
    },
  },
  edu: {
    motion: { reveal: 'rise', parallax: 'soft', micro: 'lift', hero: 'cards', duration: 0.5 },
    moods: {
      calm: { axes: ax('lavender', 'humanist', 'soft', 'airy', 'minimal'), motion: { duration: 0.6 } },
      vivid: {
        axes: ax('lemon', 'rounded', 'pill', 'compact', 'playful'),
        motion: { reveal: 'scale', micro: 'wiggle', duration: 0.38 },
      },
      premium: {
        axes: ax('midnight', 'geometric', 'soft', 'airy', 'premium'),
        motion: { reveal: 'fade', parallax: 'deep', duration: 0.8 },
      },
    },
  },
  realty: {
    motion: { reveal: 'fade', parallax: 'deep', micro: 'lift', hero: 'search', duration: 0.65 },
    moods: {
      calm: { axes: ax('sand', 'humanist', 'soft', 'airy', 'minimal') },
      vivid: {
        axes: ax('skylight', 'geometric', 'soft', 'compact', 'bold'),
        motion: { reveal: 'slide', micro: 'press', duration: 0.4 },
      },
      premium: {
        axes: ax('noir', 'serif', 'sharp', 'airy', 'premium'),
        motion: { parallax: 'soft', duration: 0.9 },
      },
    },
  },
  repair: {
    motion: { reveal: 'slide', parallax: 'none', micro: 'press', hero: 'photo', duration: 0.45 },
    moods: {
      calm: { axes: ax('lemon', 'grotesk', 'soft', 'compact', 'minimal'), motion: { reveal: 'rise', duration: 0.55 } },
      vivid: {
        axes: ax('ember', 'condensed', 'sharp', 'compact', 'bold'),
        motion: { parallax: 'soft', micro: 'wiggle', duration: 0.32 },
      },
      premium: {
        axes: ax('graphite', 'grotesk', 'sharp', 'airy', 'premium'),
        motion: { reveal: 'fade', micro: 'lift', duration: 0.8 },
      },
    },
  },
}

export const defaultThemeMood: ThemeMood = 'calm'

export function themeAxes(id: ThemeId, mood: ThemeMood = defaultThemeMood): ThemeAxes {
  return themes[id].moods[mood].axes
}

export function themeMotion(id: ThemeId, mood: ThemeMood = defaultThemeMood): MotionPreset {
  return { ...themes[id].motion, ...themes[id].moods[mood].motion }
}

// The motion of the mockup when no theme is chosen: the studio default, nearly still.
export const neutralMotion: MotionPreset = {
  reveal: 'fade',
  parallax: 'none',
  micro: 'none',
  hero: 'split',
  duration: 0.4,
}

// The theme that suits a niche best (offered first, never picked for the visitor).
export const kindTheme: Record<KindId, ThemeId> = {
  cafe: 'coffee', restaurant: 'coffee', coffee: 'coffee', bakery: 'coffee', delivery: 'shop', catering: 'coffee',
  barber: 'salon', salon: 'salon', nails: 'salon', spa: 'salon', cosmetology: 'salon', dentist: 'clinic',
  clinic: 'clinic', fitness: 'fitness', yoga: 'fitness', massage: 'salon',
  shop: 'shop', webshop: 'shop', flowers: 'shop', gifts: 'shop', clothing: 'shop', electronics: 'shop',
  furniture: 'shop', autoparts: 'repair',
  carservice: 'repair', carwash: 'repair', drycleaning: 'repair', cleaning: 'repair', repair: 'repair',
  renovation: 'repair', photo: 'salon', events: 'salon', printing: 'repair',
  tutor: 'edu', languages: 'edu', kidscenter: 'edu', drivingschool: 'edu', onlineschool: 'edu',
  realty: 'realty', lawyers: 'legal', accounting: 'legal', insurance: 'legal',
  travel: 'realty', hotel: 'realty', guesthouse: 'realty', tours: 'realty',
  services: 'legal', logistics: 'repair', wholesale: 'shop', itservices: 'it', marketing: 'it', coworking: 'it',
  pharmacy: 'clinic', vet: 'clinic', petshop: 'shop',
  other: 'shop',
}

// Old ready looks (`y.` chunk with a kit) mapped to the closest theme.
export const kitTheme: Record<string, ThemeId> = {
  fir: 'it', nocturne: 'fitness', atelier: 'salon', sunny: 'coffee', candy: 'salon', brutal: 'it',
  luxe: 'salon', clinic: 'clinic', eco: 'clinic', bistro: 'coffee', barber: 'fitness', techy: 'it',
  aurora: 'it', journal: 'edu', kids: 'edu', forest: 'legal', wine: 'salon', coffee: 'coffee', ember: 'fitness',
}
