import { productAnchor, productIds, productPath, type ProductId } from './product-ids'
import { serviceSlugs, type ServiceSlug } from './site'
import { solutionKinds } from './solutions'

type FeaturedKind = (typeof solutionKinds)[number]

// Home page map (stage B1, docs/site-design-notes.md): sections, products first. The page
// renders `homeSections` in this order; each one's anchor id is in `sectionAnchor` (null = no
// anchor). Tested in tests/site-b1.test.mjs.
export const homeSections = [
  'hero',
  'products',
  'demo',
  'solutions',
  'process',
  'pricing',
  'faq',
  'footer',
] as const
export type HomeSection = (typeof homeSections)[number]

export const sectionAnchor: Record<HomeSection, string | null> = {
  hero: 'top',
  products: 'products',
  demo: 'demo',
  solutions: 'solutions',
  process: 'process',
  pricing: 'pricing',
  faq: 'faq',
  footer: null,
}

// Every anchor that exists on the home page: the sections, the FAQ inside the last section, the
// old `#services` (kept on the products section for old links) and one per product card.
export const homeAnchors: string[] = [
  ...homeSections.flatMap((s) => (sectionAnchor[s] ? [sectionAnchor[s] as string] : [])),
  'services',
  ...productIds.map(productAnchor),
]

// Pages under /[locale] besides the home page (directories in src/app/[locale]).
export const localePages = ['builder', 'blog', 'privacy', 'solutions', 'referral', 'compare', 'audit', 'status', 'ai-team', 'pay-how', 'how-we-work'] as const

export type FooterLink =
  | { kind: 'product'; id: ProductId; href: string }
  | { kind: 'service'; id: ServiceSlug; href: string }
  | { kind: 'solution'; id: FeaturedKind; href: string }
  | { kind: 'page'; id: string; href: string }

export type FooterColumn = { id: 'products' | 'services' | 'solutions' | 'company'; links: FooterLink[] }

// Footer columns as data, so a test can check that every link points to a real route.
export function footerColumns(locale: string): FooterColumn[] {
  return [
    {
      id: 'products',
      links: [
        ...productIds.map((id): FooterLink => ({ kind: 'product', id, href: `/${locale}${productPath(id)}` })),
        { kind: 'page', id: 'ai-team', href: `/${locale}/ai-team` },
      ],
    },
    {
      id: 'services',
      links: serviceSlugs.map((id) => ({ kind: 'service', id, href: `/${locale}/services/${id}` })),
    },
    {
      id: 'solutions',
      links: [
        { kind: 'page', id: 'solutions', href: `/${locale}/solutions` },
        ...solutionKinds.map(
          (id): FooterLink => ({ kind: 'solution', id, href: `/${locale}/solutions/${id}` }),
        ),
      ],
    },
    {
      id: 'company',
      links: [
        { kind: 'page', id: 'builder', href: `/${locale}/builder` },
        { kind: 'page', id: 'pricing', href: `/${locale}#pricing` },
        { kind: 'page', id: 'process', href: `/${locale}/how-we-work` },
        { kind: 'page', id: 'blog', href: `/${locale}/blog` },
        { kind: 'page', id: 'pay-how', href: `/${locale}/pay-how` },
        { kind: 'page', id: 'compare', href: `/${locale}/compare` },
        { kind: 'page', id: 'referral', href: `/${locale}/referral` },
        { kind: 'page', id: 'audit', href: `/${locale}/audit` },
        { kind: 'page', id: 'status', href: `/${locale}/status` },
      ],
    },
  ]
}
