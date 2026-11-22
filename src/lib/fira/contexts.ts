import type { Emotion } from './pose'
import type { Accessory, EventKind, Turtle } from './turtle'

// Where Fira appears and what she does there: pose, accessory, a sample line and the shell event she
// reacts to. The site reads this map later; the rig needs no change to be wired in (round four).
export type FiraContext = { id: string; label: string; emotion: Emotion; acc?: Accessory; line: string; event?: EventKind; turtle?: Turtle }

export const pageContexts: FiraContext[] = [
  { id: 'home', label: 'Главная', emotion: 'wave', acc: 'headphones', line: 'Привет, я Фира. Расскажите, что нужно вашему делу, а я соберу план.' },
  { id: 'products', label: 'Продукты', emotion: 'point', acc: 'pen+folder', line: 'Вот семь продуктов. Выберите один, а к нему я подскажу остальное.' },
  { id: 'builder', label: 'Сборка проекта', emotion: 'thinking', acc: 'laptop', line: 'Добавляю модули и считаю этапы. Цена обновляется на ходу.', event: 'message' },
  { id: 'chat', label: 'Чат', emotion: 'listening', acc: 'phone', line: 'Слушаю. Пишите как есть, уточню по дороге.' },
  { id: 'telegram', label: 'Telegram', emotion: 'happy', acc: 'phone', line: 'Заявка пришла в Telegram. Я уже ответила клиенту.', event: 'lead' },
  { id: 'docs', label: 'Документы', emotion: 'thinking', acc: 'glasses', line: 'Проверяю смету и договор. Всё сходится, можно подписывать.', turtle: 'q' },
  { id: 'cabinet', label: 'Кабинет', emotion: 'idle', acc: 'coffee', line: 'Этап принят. Следующий начнём после оплаты.', event: 'done' },
  { id: '404', label: '404', emotion: 'sorry', acc: 'magnifier', line: 'Такой страницы нет. Я посмотрела везде, давайте вернёмся на главную.' },
]

export const nicheContexts: FiraContext[] = [
  { id: 'salon', label: 'Салон', emotion: 'happy', acc: 'hairdryer', line: 'Запишу клиентку на пятницу и напомню за день.' },
  { id: 'clinic', label: 'Клиника', emotion: 'listening', acc: 'stethoscope', line: 'Подберу удобное время к врачу и пришлю памятку.', turtle: 'q' },
  { id: 'cafe', label: 'Кафе', emotion: 'wave', acc: 'tray', line: 'Столик на четверых в семь вечера? Забронировала.' },
  { id: 'carservice', label: 'Автосервис', emotion: 'point', acc: 'wrench', line: 'Заменим масло за час. Запись на завтра открыта.', turtle: 'p' },
  { id: 'courses', label: 'Курсы', emotion: 'talking', acc: 'book', line: 'Урок в четверг, домашнее задание уже в чате.' },
  { id: 'shop', label: 'Магазин', emotion: 'happy', acc: 'bag', line: 'Заказ собран. Курьер приедет сегодня до шести.', turtle: 'p' },
]

export const allContexts = [...pageContexts, ...nicheContexts]
export const contextById = (id: string) => allContexts.find((c) => c.id === id)

// ---- Round eight: which accessories Fira wears where (the owner, 2026-11-23: all variants stay, the context picks) ----
export type AccKey = 'glasses' | 'headphones' | 'laptop'
export const accessoryByContext: Record<string, readonly AccKey[]> = {
  home: [], landing: [],
  products: ['glasses'], pricing: ['glasses'], docs: ['glasses'], quote: ['glasses'],
  chat: ['headphones'], listening: ['headphones'], support: ['headphones'],
  builder: ['glasses', 'laptop'], content: ['glasses', 'laptop'], dashboard: ['glasses', 'laptop'],
}
export const accessoryContexts = Object.keys(accessoryByContext)
export const accessoryLabels: Record<string, string> = {
  home: 'Главная', landing: 'Лендинг', products: 'Продукты', pricing: 'Цены', docs: 'Документы', quote: 'Смета',
  chat: 'Чат', listening: 'Слушает', support: 'Поддержка', builder: 'Сборка проекта', content: 'Контент', dashboard: 'Дашборд',
}
export const accessoryEmotion: Record<string, Emotion> = {
  home: 'wave', landing: 'idle', products: 'idle', pricing: 'idle', docs: 'thinking', quote: 'thinking',
  chat: 'listening', listening: 'listening', support: 'listening', builder: 'idle', content: 'idle', dashboard: 'idle',
}
/** The accessories for a page or content context (id or FiraContext). An empty list is the bare base; unknown ids give the base. */
export function accessoriesFor(ctx: string | { id: string } | undefined | null): readonly AccKey[] {
  const id = typeof ctx === 'string' ? ctx : ctx?.id
  return (id && accessoryByContext[id]) || []
}
export const isAccessoryContext = (v: unknown): v is string => typeof v === 'string' && v in accessoryByContext
