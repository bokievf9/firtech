# Copy audit 2026-11-23: Telegram sweep and repetition

Owner: «в многих местах упоминания о Telegram, нужно все возможные каналы предлагать»; «много повторений на сайте
и много слов-пересечений». Scope: dictionaries (`src/content/*.ts` except the builder files), blog articles, tests.

## a) Telegram / «бот» occurrences

Dictionary strings with «Telegram», «телеграм» or the word «бот» (not «работа»):
ru.ts 210 lines before, en.ts 201 lines before. After: the lines left are all «keep» (list below).

Classes:
- keep (fact): the Telegram Mini App product and its pages (`products.items.miniapp`, `productPage.items.miniapp`,
  `solutions.items.delivery`, `showcase.items.delivery`, `film.team.miniapp`); channel lists (`faq` channel answer, `how.tools`,
  `aiTeams` publishing platforms, `productPage...chips` where Telegram stands next to WhatsApp and mail); the studio's own
  contact (`contact`, `chat` fallbacks, `booking`, `*.ctaTelegram`, `audit` result delivered by @firtech_bot, `pay`, `payHow`,
  `statusPage`); `privacy` and `terms` (the studio's real bot, data flow); the mock labels of the home illustration;
  `notFound` search keywords; the estimator add-ons «Заявки в Telegram» / «Уведомления в Telegram» (real catalog lines, the
  estimate test quotes them).
- rewrite (Telegram as the default or only place), all done: home meta and hero caption; home product cards `inside[]`
  (personal, admin, receptionist, content); services `bots` («Агенты в Telegram» is now «Агенты в мессенджерах») with its
  detail page (title, steps, included, fits) and `automation` / `websites` details; extras `ai`, `payments`; solutions cafe,
  salon, shop FAQ, services niche; showcase cafe and sales; product pages admin, receptionist, content, automation,
  company (capabilities, chips, day, FAQ, «Утверждение в Telegram» is now «Утверждение одной кнопкой»); `faq` (remote work);
  showcase film pains and office; blog `website-or-bot` (title and copy), `stop-losing-leads`, `website-cost-2026`
  (the word «бот» became «агент»).
- not touched on purpose: `admin`, `cabinet`, `golive` (owner checklist), builder dictionaries (another builder owns them),
  components (code, links and the Telegram icon on buttons stay; the only hard-coded labels are mock icons).

Rule in the test: `tests/copy-dupes.test.mjs` fails when «Telegram» or «бот» appears at a key path outside its allow-list.

## b) Repetition over the rendered RU pages (107 public pages, dev server, HTML stripped)

| metric | before | after |
|---|---|---|
| «Telegram» / «бот» on rendered pages | 795 | 517 (the rest: legal pages, Mini App, contact, channel lists, footer) |
| identical sentences repeated on 2+ pages (5+ words) | 240 | 238 |
| the same, 8+ words | 122 | 123 |
| sentences repeated inside one page | 141 | 137 |
| «рутина» | 132 | 113 |
| dictionary sentences of 8+ words (RU) repeated under two keys | 18 | 0 |
| the same in EN (10+ words) | 21 | 0 |

The rendered counts barely move because most repeats are one dictionary key rendered by a shared component on many pages:
the footer tagline (107 pages), the stages note and the «Так проект идёт» block on 55 solution pages, the model-cost note on
26 department pages, the channel line on 26 pages. By the owner's rule that boilerplate lives in one component, it stays
one key, and the test only forbids the same sentence under two keys. On each solution page the payment rule is now said
once (`payNote` and `stagesSub` were shortened, `stageRule` stays).

Rewritten to remove a repeated sentence (each in RU and EN): the «Сколько это стоит?» answers (23 agent pages and the
department pages had one opening sentence), the approvals, refund and payment sentences between `faq`, `how` and `compare`.
Exempt by rule: the first-reply promise and the guarantee are word for word the same everywhere (tests `sla`, `copy-qa`).

Top overused words on rendered RU pages (stems): агент ~1250, команд ~420, автоматиз ~400, заявк ~300, сборк ~190,
автопилот ~160 (a level name, kept), рутин 132 -> 113, удобн 20, ассистент 10. Fixes: «рутина» varied in 10 places
(«повторяющаяся работа», «типовые задачи», «ручная работа», «личные дела»); «в удобном канале» from 5 to 2 (home hero and
the department page keep it).

## c) Glossary (one term per concept)

- Фира / Fira: the AI assistant of Fir Tech (name). «ИИ-менеджер заявок», «ИИ-администратор»: product names only.
- Менеджер заявок: the lead agent. Not «приёмщик».
- Агент: what we build and sell. «Бот» only inside a proper name of a real bot (@firtech_bot) or a platform term (BotFather).
- Канал: the place an agent lives (Telegram, WhatsApp, чат на сайте, кабинет, голос, почта, рабочий стол), always listed as equals.
  Neutral phrasings: «в чате», «в мессенджере», «в канале на ваш выбор», «там, где пишут клиенты».
- Сборка проекта: the project builder. Not «конструктор», not «калькулятор».
- ИИ-команда / отдел: «ИИ-команда» is the product (department of agents), «команда» alone means people, ours or the client's.
- Смета: the priced quote after the call. «Оценка» is the estimate shown in the builder.
- Рутина: only in the hero and the «Автоматизация рутины» service name; elsewhere «повторяющаяся работа», «типовые задачи».

## Left for later

- Hard-coded component text (mock icons, `service-visuals.tsx` chain label) still names Telegram.
- The footer tagline and boilerplate blocks could be collapsed on the solution pages by design (a layout decision).
