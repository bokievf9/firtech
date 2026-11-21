// Id lists of the project builder («Сборка проекта») that travel in the `?b=` link. A leaf module with
// no imports, so builder.ts, the catalogue and the themes can all use it. Ids never contain `.`, `-`
// or `~` (the link's separators). New ids are only ever appended: old links must keep decoding.

// Goals. The first five are the original ones (old links); the rest are outcome goals per product family.
export const legacyGoals = ['leads', 'sales', 'booking', 'routine', 'brand'] as const
// `agent` is the classic Telegram bot; `admin`, `leadmgr` and `assistant` are the three agent products
// (2026-11-22: each has its own set). Families are only ever appended.
export const goalFamilies = ['agent', 'site', 'automation', 'content', 'miniapp', 'department', 'app', 'admin', 'leadmgr', 'assistant'] as const
export type GoalFamily = (typeof goalFamilies)[number]

export const familyGoalIds = {
  agent: ['answer24', 'nocalls', 'noshow', 'leadcollect', 'faqoff', 'upsell', 'reviews', 'handover'],
  site: ['moreleads', 'trust', 'prices', 'onlineorder', 'search', 'langs', 'portfolio', 'offer'],
  automation: ['nomanual', 'oneplace', 'reports', 'alerts', 'nolost', 'paytrack', 'synctools'],
  content: ['regular', 'reels', 'cards', 'lesstime', 'voice', 'stories', 'season'],
  miniapp: ['ordertg', 'loyalty', 'repeat', 'paytg', 'catalog', 'bookingtg', 'promo'],
  department: ['knowledge', 'docs', 'train', 'oneassist', 'onboard', 'control', 'weeklysum', 'approvals'],
  app: ['ownapp', 'teamtool', 'cabinet', 'offline', 'pushapp', 'dashboard', 'payinapp', 'loginapp'],
  admin: ['nocalls', 'noshow', 'answer24', 'faqoff', 'fillslots', 'upsell', 'reviews', 'handover'],
  leadmgr: ['answer24', 'speedlead', 'leadcollect', 'qualify', 'followup', 'nolost', 'faqoff', 'handover'],
  assistant: ['deadlines', 'inbox', 'planday', 'remindme', 'calsync', 'langstudy', 'focus', 'weekly'],
} as const satisfies Record<GoalFamily, readonly string[]>

// Families share goals (the administrator and the lead manager both answer at any hour), so the flat list is unique.
export const buildGoals = [
  ...new Set([...legacyGoals, ...goalFamilies.flatMap((family) => familyGoalIds[family])]),
] as readonly string[] as readonly [string, ...string[]]
export type BuildGoal = string

// Where customers look for the business now (twelve channels).
export const buildChannels = [
  'instagram',
  'telegram',
  'search',
  'word',
  'maps',
  'tiktok',
  'whatsapp',
  'youtube',
  'market',
  'ads',
  'offline',
  'partners',
] as const
export type BuildChannel = (typeof buildChannels)[number]

// Details that save the first call.
export const detailLangs = ['ru', 'en', 'tj', 'uz'] as const
export type DetailLang = (typeof detailLangs)[number]
export const detailAssets = ['logo', 'texts', 'photos', 'domain', 'hosting', 'access'] as const
export type DetailAsset = (typeof detailAssets)[number]
export const detailDeadlines = ['asap', 'w2', 'month', 'quarter', 'relaxed'] as const
export type DetailDeadline = (typeof detailDeadlines)[number]
export const clientTypes = ['private', 'biz', 'family', 'youth', 'vip', 'tourist'] as const
export type ClientType = (typeof clientTypes)[number]
export const clientSources = ['calls', 'msgs', 'walkin', 'ads', 'recs', 'market', 'site', 'none'] as const
export type ClientSource = (typeof clientSources)[number]
export const afterSteps = ['notify', 'autoreply', 'slot', 'qualify', 'price', 'crm', 'remind', 'followup'] as const
export type AfterStep = (typeof afterSteps)[number]
export const clientTools = ['crm', 'onec', 'sheets', 'amocrm', 'bitrix', 'kaspi', 'payme', 'none'] as const
export type ClientTool = (typeof clientTools)[number]
export const fears = ['price', 'quality', 'terms', 'aimistake', 'data', 'support', 'hard'] as const
export type Fear = (typeof fears)[number]
export const budgets = ['b300', 'b1k', 'b3k', 'b3kp'] as const
export type Budget = (typeof budgets)[number]

// Where an agent lives (delivery channels), kept apart from what it does.
export const deliveryChannels = ['telegram', 'widget', 'whatsapp', 'playground'] as const
export type DeliveryChannel = (typeof deliveryChannels)[number]
// Does the agent get a website? `have` = the client already has one.
export const siteNeeds = ['need', 'no', 'have'] as const
export type SiteNeed = (typeof siteNeeds)[number]

// Themes by genre and niche, with three moods.
export const themeIds = [
  'clinic',
  'salon',
  'coffee',
  'shop',
  'legal',
  'it',
  'fitness',
  'edu',
  'realty',
  'repair',
] as const
export type ThemeId = (typeof themeIds)[number]
export const themeMoods = ['calm', 'vivid', 'premium'] as const
export type ThemeMood = (typeof themeMoods)[number]

// Options of the two flagships (owner 2026-11-22), chunk `f.<product>.<id-id>`. Personal AI: the services it
// connects, a voice and a long memory (they set the level); AI company: departments, the control room,
// the knowledge base, client channels and team training (the exact sum comes from the quote).
export const flagshipProducts = ['personal', 'company'] as const
export type FlagshipProduct = (typeof flagshipProducts)[number]
export const personalServices = ['mail', 'calendar', 'tasks', 'study', 'notes', 'messengers'] as const
export const personalExtras = ['voice', 'memory'] as const
export const companyDepts = ['sales', 'marketing', 'support', 'production', 'backoffice'] as const
export const companyParts = ['pult', 'knowledge', 'channels', 'training'] as const
export const flagshipOptionIds = {
  personal: [...personalServices, ...personalExtras],
  company: [...companyDepts, ...companyParts],
} as const satisfies Record<FlagshipProduct, readonly string[]>
export type FlagshipOption<P extends FlagshipProduct = FlagshipProduct> = (typeof flagshipOptionIds)[P][number]
