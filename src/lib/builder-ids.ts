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

// Personal path of «Сборка проекта» (owner 2026-11-22: the builder was business-only; the personal agent is
// widened and the builder is where we learn everything about the client). Ids only ever appended.
export const personalWho = ['student', 'founder', 'doctor', 'freelancer', 'manager', 'parent', 'blogger', 'teacher', 'other'] as const
export type PersonalWho = (typeof personalWho)[number]
// v5 (2026-11-23): six more people (9 -> 15). Kept apart from `personalWho` because the Personal AI page, the chat
// persona and its day examples speak about the first eight only; the builder accepts both lists (`personalWhoAll`).
export const personalWhoMore = ['engineer', 'researcher', 'lawyer', 'retiree', 'traveler', 'athlete'] as const
export type PersonalWhoMore = (typeof personalWhoMore)[number]
export const personalWhoAll = [...personalWho, ...personalWhoMore] as const
export type PersonalWhoAny = PersonalWho | PersonalWhoMore
export const personalHand = ['mail', 'calendar', 'study', 'money', 'health', 'languages', 'content', 'home', 'docs', 'reminders', 'calls', 'search'] as const
export type PersonalHand = (typeof personalHand)[number]
// Where the personal agent lives. Telegram is one channel among equals. When the products builder lands
// `lib/channels.ts`, point this list at it (TODO, see docs/builder-v2.md «brief v4 contract»).
export const personalChannels = ['telegram', 'whatsapp', 'webchat', 'cabinet', 'voice', 'email', 'desktop'] as const
export type PersonalChannel = (typeof personalChannels)[number]
// v5: 9 -> 25, the new ids appended after `other`.
export const personalConnect = [
  'google', 'microsoft', 'apple', 'moodle', 'notion', 'telegram', 'whatsapp', 'bank', 'other',
  'slack', 'todoist', 'trello', 'obsidian', 'github', 'dropbox', 'zoom', 'evernote',
  'applehealth', 'strava', 'linkedin', 'instagram', 'youtube', 'canvas', 'anki', 'kaspi',
] as const
export type PersonalConnect = (typeof personalConnect)[number]
// Five character axes, each 0..2: formality (friendly..formal), brevity (short..detailed), initiative (waits..proactive),
// humour (serious..playful), firmness (soft..strict reminders). Old links carry three values: the rest default to 1.
export type PersonalTone = number[]
export const toneAxes = 5
export const personalTiers = ['basic', 'plus', 'max'] as const // «Спутник», «Второй пилот», «Второе я»

// Discovery (both paths): optional short answers that help a quote and Fira.
// Builder depth (2026-11-24): 6 to 8 chips per question. Ids are only ever appended; a legacy id stays known so an old
// link decodes, but is not offered (`...Shown`). Every list that ends in `other` has a «Другое» chip that opens the note.
export const discSizes = ['solo', 's5', 's20', 's20p', 's10', 's50', 's50p'] as const
export type DiscSize = (typeof discSizes)[number]
export const discSizesShown = ['solo', 's5', 's10', 's20', 's50', 's50p'] as const
export const discLeads = ['d5', 'd20', 'd50', 'd50p', 'dnone', 'd100', 'd100p'] as const // requests a day
export type DiscLeads = (typeof discLeads)[number]
export const discLeadsShown = ['dnone', 'd5', 'd20', 'd50', 'd100', 'd100p'] as const
export const discBase = ['k100', 'k1k', 'k10k', 'k10kp', 'k0', 'k500', 'k5k'] as const // clients in the base
export type DiscBase = (typeof discBase)[number]
export const discBaseShown = ['k0', 'k100', 'k500', 'k1k', 'k5k', 'k10k', 'k10kp'] as const
export const discHours = ['h9', 'h24', 'hshift', 'hflex', 'hlate', 'hweekend', 'hseason'] as const
export type DiscHours = (typeof discHours)[number]
export const discApprover = ['owner', 'manager', 'team', 'auto', 'partners', 'admin', 'client'] as const
export type DiscApprover = (typeof discApprover)[number]
export const discPains = ['calls', 'lost', 'slow', 'manual', 'noshow', 'reports', 'chaos', 'time', 'content', 'money', 'other'] as const
export type DiscPain = (typeof discPains)[number]
export const discSuccess = ['leads', 'time', 'lost', 'revenue', 'calm', 'control', 'speed', 'quality', 'growth', 'other'] as const
export type DiscSuccess = (typeof discSuccess)[number]
export const discHeard = ['search', 'instagram', 'friend', 'telegram', 'ai', 'ads', 'other'] as const
export type DiscHeard = (typeof discHeard)[number]
// New questions of the same screen.
export const discSrc = ['instagram', 'telegram', 'whatsapp', 'search', 'ads', 'friends', 'offline', 'other'] as const // where clients come from
export type DiscSrc = (typeof discSrc)[number]
export const discTools = ['sheets', 'excel', 'amocrm', 'bitrix', 'onec', 'messengers', 'none', 'other'] as const // tools now
export type DiscTool = (typeof discTools)[number]
export const discLangs = ['ru', 'tj', 'en', 'uz', 'kz', 'other'] as const
export type DiscLang = (typeof discLangs)[number]
export const discWhen = ['asap', 'month', 'quarter', 'half', 'norush', 'date'] as const // the deadline
export type DiscWhen = (typeof discWhen)[number]
// «О вас» (personal path).
export const discRole = ['employed', 'business', 'freelance', 'study', 'creative', 'mixed', 'other'] as const
export type DiscRole = (typeof discRole)[number]
export const discRhythm = ['early', 'owl', 'evening', 'shifts', 'travel', 'weekends', 'irregular'] as const
export type DiscRhythm = (typeof discRhythm)[number]
export const discChan = ['telegram', 'whatsapp', 'instagram', 'email', 'imessage', 'slack', 'phone', 'other'] as const
export type DiscChan = (typeof discChan)[number]
export const discDev = ['iphone', 'android', 'mac', 'windows', 'ipad', 'web', 'watch', 'linux'] as const
export type DiscDev = (typeof discDev)[number]
