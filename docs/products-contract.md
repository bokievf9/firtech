# Контракт продуктов для HQ (флагманы, 2026-11-22)

Сайт меняет линейку продуктов (пункт 14 ревью владельца). HQ (`agents`) читает её из `GET /api/prices` и из
этого файла. Здесь точные id, имена, цены и правила «нужда → продукт», которые HQ переносит к себе
(`packages/core/src/product-names.ts`, `packages/core/src/prices.ts`, `apps/hq/src/client/needs.ts`).

## Линейка и порядок

Флагманы первыми везде, где перечисляются продукты (каталог, сборка, прайс, llms.txt, sitemap, JSON-LD, футер, 404):

| Порядок | id страницы | id сборки (`p.`) | RU | EN |
|---|---|---|---|---|
| 1 | `personal` | `personal` | Персональный ИИ | Personal AI |
| 2 | `company` | `company` | ИИ-компания | AI company |
| 3 | `admin` | `adminbot` | ИИ-администратор | AI booking assistant |
| 4 | `receptionist` | `intake` | ИИ-менеджер заявок | AI lead manager |
| 5 | `automation` | `automation` | Автоматизация процессов | Process automation |
| 6 | `content` | `content` | Контент на автопилоте | Content on autopilot |
| 7 | `miniapp` | `miniapp` | Telegram Mini App | Telegram Mini App |
| 8 | `implementation` | `aiteam` | ИИ-отдел под ключ | AI department, turnkey |

- Продукт `agent` («Персональный ИИ-ассистент») снят: его заменяет `personal`. Адрес `/products/agent` (и
  `/ru|en/products/agent`) отдаёт постоянный редирект на `/products/personal`. Старые ссылки сборки с `p.agent`
  читаются как `p.personal`.
- Dono и Polly больше не продаются: это живые кейсы основателя на странице Персонального ИИ, без цен.
- Лестница: должность (один агент) → отдел (`implementation`, «ИИ-отдел под ключ») → компания (`company`).

## Цены (`GET /api/prices`)

Источник один: `src/lib/pricing.ts` (`defaultPricing`) + правки владельца в Пульте.

- `personalPlans`: массив `{id, setup, monthly}` из трёх уровней: `basic` «Старт» $290 + $29/мес, `plus`
  «Плюс» $490 + $49/мес, `max` «Максимум» $790 + $79/мес. Верхние два уровня: предложение строителя, ждут слова
  владельца.
- `companyPlan`: `{id: 'company', setup: 1490, monthly: 149}`: цена «от», точная сумма по смете.
- `products.personal` = `{kind: 'plans', plans: personalPlans}`; `products.company` = `{kind: 'plans', plans:
  [companyPlan], byQuote: true}`. Поля `from` у них нет (HQ их не суммирует).
- `stages.company`: новый шаблон этапов из четырёх по 25% (как `app`): `map` «Карта компании и Директор», `depts`
  «Первые отделы на ваших данных», `pult` «Пульт, база знаний и каналы», `launch` «Обучение команды и запуск».
  Сейчас HQ неизвестные шаблоны пропускает: нужно добавить `company` в `DEFAULT_STAGE_TEMPLATES` с products
  `['company']`.
- `agentPlans` (dono, polly) **устарели**, но остаются в ответе, потому что схема HQ требует их. Когда HQ перестанет
  проверять `agentPlans.dono|polly`, сайт их удалит.

## Сборка: опции флагманов

Чанк ссылки `f.<product>.<id-id>` (порядок как ниже, неизвестные id игнорируются):

- `f.personal.`: сервисы `mail calendar tasks study notes messengers`, возможности `voice memory`. Уровень:
  до двух сервисов `basic`; три-четыре сервиса или `voice` `plus`; пять и больше сервисов или `memory` `max`.
- `f.company.`: отделы `sales marketing support production backoffice`, части `pult knowledge channels training`.
- По умолчанию (опций нет): `personal` = `mail calendar`, `company` = `sales pult knowledge training`.
- В смете и в тексте заявки флагман идёт строкой «по смете» с ценой плана: «Персональный ИИ (Почта, Календарь,
  Голос; Плюс: $490 + $49/мес)», «ИИ-компания (...; от $1 490 + $149/мес, точная сумма по смете)». В итог
  разовой суммы не входит.

## Правила «нужда → продукт» для ИИ-менеджера (HQ `client/needs.ts`)

Порядок: узкое раньше широкого; `company` раньше `department` (`implementation`).

| Правило | Слова клиента (примеры) | Продукт |
|---|---|---|
| `company` | «вся компания», «всю компанию», «все отделы», «отделы», «как у вас», «как у Fir Tech», «компания на агентах», «ИИ-компания», «директор из ИИ», whole company, all departments, like yours | `company` |
| `personal` | «личный помощник», «личный ассистент», «персональный ИИ», «для себя», «для меня», «мне лично», «мой календарь», «моя почта», «учёба», personal AI, for myself, my own assistant | `personal` |
| `department` (как сейчас) | «ИИ-отдел», «отдел из агентов», «база знаний» | `implementation` (`aiteam`) |

- «отдел» в единственном числе с названием (отдел продаж) остаётся `implementation`; «отделы» во множественном и
  «вся компания» ведут на `company`.
- Цена в ответе: Персональный ИИ «от $290 + $29 в месяц, три уровня по числу сервисов»; ИИ-компания «от $1 490 +
  $149 в месяц, точную сумму назовём в смете». Числа брать только из `/api/prices`.
- Оффер флагманов: «первые 1-2 пилота бесплатно за кейс и отзыв», только для `personal` и `company`. «Демо на ваших
  данных за 24 часа» пока не обещать.
- Персона площадки/демо: `personal` (сценарий владельца кофейни: утренняя сводка, почта, обещания, время на дела, урок
  языка), тексты в `demoSection.personal`.
