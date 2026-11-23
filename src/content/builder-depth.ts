import type { L } from './builder-catalog'
import { hoursText, langText } from './builder-personal'
import { depthQuestions } from '../lib/builder-depth'

// Copy of the depth screen of the agent path (2026-11-24): the department questions and their chips, RU and EN side by
// side. No em or en dashes. Ids come from `lib/builder-depth.ts`; every option of every question needs a label here.

const l = (ru: string, en: string): L<string> => ({ ru, en })

export const depthUi = {
  title: l('Расскажите подробнее', 'Tell us more'),
  sub: l('Всё по желанию: чем точнее, тем меньше вопросов на созвоне.', 'All optional: the more exact, the fewer questions on the call.'),
  note: l('Своими словами', 'In your own words'),
  notePlaceholder: l('Например: как у вас принято отвечать, что агент не должен делать, чего боитесь', 'For example: how you usually answer, what the agent must not do, what worries you'),
  noteHint: l('Не больше 500 символов. Пароли и коды сюда не пишите.', 'Up to 500 characters. Please do not put passwords or codes here.'),
  label: l('Подробности', 'Details'),
}

export const depthTitle: Record<string, L<string>> = {
  'sl-src': l('Откуда приходят заявки', 'Where leads come from'),
  'sl-crm': l('Какая CRM сейчас', 'Which CRM you use'),
  'sl-resp': l('Желаемое время ответа', 'Target response time'),
  'sl-lang': l('Языки клиентов', 'Client languages'),
  'sl-hours': l('Рабочие часы', 'Working hours'),
  'su-vol': l('Обращений в день', 'Tickets a day'),
  'su-chan': l('Каналы обращений', 'Ticket channels'),
  'su-sla': l('Время первого ответа', 'First reply target'),
  'su-kb': l('Откуда брать ответы', 'Where answers come from'),
  'su-lang': l('Языки клиентов', 'Client languages'),
  'mk-plat': l('Площадки', 'Platforms'),
  'mk-cad': l('Как часто публикуем', 'Posting cadence'),
  'mk-tone': l('Тон', 'Tone'),
  'mk-brand': l('Что есть из фирменного', 'Brand assets you have'),
  'mk-lang': l('Языки контента', 'Content languages'),
  'pr-type': l('Типы проектов', 'Project types'),
  'pr-tools': l('Инструменты команды', 'Team tools'),
  'pr-rep': l('Отчётность', 'Reporting'),
  'pr-hours': l('Рабочие часы', 'Working hours'),
  'bo-docs': l('С какими документами работаем', 'Documents involved'),
  'bo-inv': l('Чем выставляете счета', 'How you invoice'),
  'bo-appr': l('Кто согласовывает', 'Who approves'),
  'bo-lang': l('Языки документов', 'Document languages'),
  'co-lang': l('Языки', 'Languages'),
  'co-hours': l('Рабочие часы', 'Working hours'),
  'co-tools': l('Чем пользуетесь сейчас', 'What you use now'),
}

const other = l('Другое', 'Other')
const text = {
  instagram: l('Instagram', 'Instagram'), telegram: l('Telegram', 'Telegram'), whatsapp: l('WhatsApp', 'WhatsApp'),
  site: l('Сайт', 'Website'), ads: l('Реклама', 'Ads'), referral: l('Рекомендации', 'Referrals'), calls: l('Звонки', 'Calls'),
  email: l('Почта', 'Email'), web: l('Чат на сайте', 'Site chat'), phone: l('Телефон', 'Phone'),
  none: l('Ничего пока', 'Nothing yet'), sheets: l('Таблицы', 'Sheets'), amocrm: l('amoCRM', 'amoCRM'), bitrix: l('Битрикс24', 'Bitrix24'),
  hubspot: l('HubSpot', 'HubSpot'), onec: l('1С', '1C'), other,
  instant: l('Сразу', 'Instantly'), m5: l('За 5 минут', 'Within 5 minutes'), h1: l('За час', 'Within an hour'),
  workday: l('В течение дня', 'Within the day'), nextday: l('На следующий день', 'Next day'),
  t10: l('До 10', 'Up to 10'), t50: l('10-50', '10-50'), t200: l('50-200', '50-200'), t1000: l('200-1000', '200-1,000'), t1000p: l('Больше 1000', 'Over 1,000'),
  docs: l('Документы', 'Documents'), faq: l('Частые вопросы', 'FAQ'), chats: l('Прошлые переписки', 'Past chats'), crm: l('CRM', 'CRM'), nothing: l('Пока ничего нет', 'Nothing yet'),
  tiktok: l('TikTok', 'TikTok'), youtube: l('YouTube', 'YouTube'), linkedin: l('LinkedIn', 'LinkedIn'), vk: l('VK', 'VK'), blog: l('Блог', 'Blog'),
  daily: l('Каждый день', 'Every day'), w3: l('3 раза в неделю', 'Three times a week'), weekly: l('Раз в неделю', 'Weekly'), rare: l('Реже', 'Less often'), unsure: l('Подскажите', 'Advise me'),
  friendly: l('Дружелюбный', 'Friendly'), expert: l('Экспертный', 'Expert'), strict: l('Строгий', 'Strict'), playful: l('Игривый', 'Playful'), premium: l('Премиум', 'Premium'), youth: l('Молодёжный', 'Youthful'),
  logo: l('Логотип', 'Logo'), palette: l('Цвета', 'Colours'), fonts: l('Шрифты', 'Fonts'), photos: l('Фото', 'Photos'), guide: l('Брендбук', 'Brand guide'),
  apps: l('Приложения', 'Apps'), design: l('Дизайн', 'Design'), video: l('Видео', 'Video'), print: l('Печать', 'Print'), services: l('Услуги', 'Services'),
  trello: l('Trello', 'Trello'), notion: l('Notion', 'Notion'), jira: l('Jira', 'Jira'), figma: l('Figma', 'Figma'),
  dashboard: l('Панель с цифрами', 'A dashboard'),
  invoices: l('Счета', 'Invoices'), contracts: l('Договоры', 'Contracts'), acts: l('Акты', 'Acts'), payroll: l('Зарплата', 'Payroll'), reports: l('Отчёты', 'Reports'), hr: l('Кадры', 'HR'),
  excel: l('Excel', 'Excel'), bank: l('Банк', 'Bank'), stripe: l('Stripe', 'Stripe'),
  owner: l('Я сам', 'I do'), accountant: l('Бухгалтер', 'An accountant'), manager: l('Руководитель', 'A manager'), smallauto: l('Мелочи автоматически', 'Small ones automatically'), chain: l('Цепочка согласований', 'An approval chain'),
  messengers: l('Мессенджеры', 'Messengers'),
} as Record<string, L<string>>

// Per-question wording where the same id means something different.
const byQuestion: Record<string, Record<string, L<string>>> = {
  'pr-type': { web: l('Сайты', 'Websites') },
  'pr-rep': { telegram: l('В Telegram', 'In Telegram'), none: l('Не нужны', 'Not needed') },
  'sl-crm': { none: l('Пока нет', 'None yet') },
  'mk-brand': { none: l('Пока нет', 'None yet') },
  'bo-inv': { none: l('Вручную', 'By hand') },
  'su-chan': { web: l('Чат на сайте', 'Site chat') },
  'sl-src': { site: l('Сайт', 'Website') },
}

export function depthLabel(question: string, option: string): L<string> {
  const per = byQuestion[question]?.[option]
  if (per) return per
  if (option in langText && /-lang$/.test(question)) return langText[option as keyof typeof langText]
  if (option in hoursText && /-hours$/.test(question)) return hoursText[option as keyof typeof hoursText]
  return text[option] ?? l(option, option)
}

export const depthIds = Object.values(depthQuestions).flat()
