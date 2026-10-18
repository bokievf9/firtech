import { dayKey } from './admin-data'
import type { IgDay, IgItem, Task } from './pulse-types'
import type { StoredLead } from './store'

// Demo data for screenshots and local design work only. It is used when PULSE_DEMO=1 and the build
// is not a production one, so a production server can never show it.
export const pulseDemoEnabled = () =>
  process.env.PULSE_DEMO === '1' && process.env.NODE_ENV !== 'production'

const DAY = 24 * 60 * 60_000
const iso = (time: number) => new Date(time).toISOString()

export function demoTasks(now: number): Task[] {
  const today = Date.parse(dayKey(now))
  const key = (offset: number) => dayKey(today + offset * DAY + 12 * 3_600_000)
  const make = (
    n: number,
    project: Task['project'],
    title: string,
    status: Task['status'],
    priority: Task['priority'],
    due: string | null,
    notes = '',
  ): Task => ({
    id: `tdemo${n}`,
    project,
    title,
    status,
    priority,
    due,
    notes,
    source: n % 3 === 0 ? 'echo' : 'ui',
    createdAt: iso(now - (20 - n) * 3_600_000),
    updatedAt: iso(now - (20 - n) * 1_800_000),
    doneAt: status === 'done' ? iso(now - 3_600_000) : null,
  })
  return [
    make(
      1,
      'firtech',
      'Подтвердить цены по каждому формату',
      'blocked',
      'high',
      key(1),
      'Нужен ответ по сайтам и ботам.',
    ),
    make(2, 'firtech', 'Политика конфиденциальности: просмотр юристом', 'blocked', 'normal', null),
    make(3, 'firtech', 'GitHub-репозиторий и автодеплой', 'doing', 'high', key(3)),
    make(4, 'firtech', 'Новые статьи в блог', 'todo', 'normal', key(7)),
    make(5, 'firtech', 'Включить Метрику', 'todo', 'low', null),
    make(6, 'firtech', 'Пульт: первая версия', 'done', 'high', null),
    make(7, 'vibely', 'Юрист в Малайзии или остаёмся на Termly', 'blocked', 'high', key(-1)),
    make(8, 'vibely', 'Открыть регистрацию вместо листа ожидания', 'blocked', 'high', null),
    make(9, 'vibely', 'Разобрать 2 несмёрженные ветки', 'todo', 'normal', key(2)),
    make(10, 'vibely', 'Удалить 170 смёрженных веток', 'todo', 'low', null),
    make(11, 'tools', 'Обновить OmniRoute', 'todo', 'normal', null),
    make(12, 'tools', 'Проверить Headroom на длинных сессиях', 'doing', 'low', key(5)),
    make(13, 'instagram', 'Снять сторис про процесс работы', 'todo', 'normal', key(0)),
    make(14, 'instagram', 'Ответить на комментарии под постом', 'doing', 'low', null),
  ]
}

export function demoIgItems(now: number): IgItem[] {
  const today = Date.parse(dayKey(now))
  const key = (offset: number) => dayKey(today + offset * DAY + 12 * 3_600_000)
  const item = (
    n: number,
    offset: number,
    time: string,
    kind: IgItem['kind'],
    title: string,
    published = false,
  ): IgItem => ({
    id: `demo-ig-${n}`,
    date: key(offset),
    time,
    kind,
    title,
    folder: `${key(offset)}-${n}`,
    note: '',
    published,
    publishedAt: published ? iso(now - DAY) : null,
  })
  return [
    item(1, -1, '10:00', 'post', 'Знакомство: кто мы', true),
    item(2, 0, '10:00', 'post', 'Сайт за неделю: как это устроено'),
    item(3, 0, '18:00', 'stories', 'Закулисье: рабочий стол'),
    item(4, 1, '12:00', 'reel', 'Пример бота для записи клиентов'),
    item(5, 2, '10:00', 'post', 'Три ошибки в сайте для малого бизнеса'),
    item(6, 3, '15:00', 'task', 'Ответить на сообщения в директе'),
  ]
}

export function demoIgDays(now: number): IgDay[] {
  const today = Date.parse(dayKey(now))
  const followers = [212, 215, 221, 224, 230, 241, 246, 252, 259]
  const reach = [380, 410, 395, 520, 610, 580, 740, 805, 790]
  return followers.map((f, i) => ({
    date: dayKey(today - (followers.length - 1 - i) * DAY + 12 * 3_600_000),
    followers: f,
    reach: reach[i] ?? null,
  }))
}

export function demoLeads(
  now: number,
): Pick<StoredLead, 'id' | 'name' | 'contact' | 'createdAt' | 'status' | 'service' | 'booking'>[] {
  const lead = (
    id: number,
    hoursAgo: number,
    status: StoredLead['status'],
    service: StoredLead['service'],
    booking?: { offsetHours: number; state: 'pending' | 'confirmed' },
  ) => ({
    id,
    name: `Клиент ${id}`,
    contact: `@demo_${id}`,
    createdAt: iso(now - hoursAgo * 3_600_000),
    status,
    service,
    booking: booking
      ? ({
          slot: iso(now + booking.offsetHours * 3_600_000),
          state: booking.state,
        } as StoredLead['booking'])
      : undefined,
  })
  return [
    lead(1, 1, 'new', 'websites', { offsetHours: 26, state: 'pending' }),
    lead(2, 3, 'new', 'bots'),
    lead(3, 9, 'taken', 'websites'),
    lead(4, 30, 'new', 'apps'),
    lead(5, 50, 'called', 'automation', { offsetHours: 5, state: 'confirmed' }),
    lead(6, 80, 'taken', 'bots'),
    lead(7, 120, 'won', 'websites'),
    lead(8, 200, 'lost', 'seo'),
    lead(9, 260, 'called', 'crm'),
    lead(10, 400, 'won', 'bots'),
    lead(11, 500, 'new', 'bundle'),
    lead(12, 640, 'lost', 'websites'),
  ]
}
