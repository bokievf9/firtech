// Owner's projects, tasks and goals for /admin/echo. Edited by hand (or by Claude on the owner's
// word); the page and the assistant read only this file plus live checks. Russian only, no em or en
// dashes. Progress numbers are the owner's estimates, not measurements.

export type ProjectId = 'vibely' | 'firtech'

export type Project = {
  id: ProjectId
  name: string
  domain: string
  // Checked live from the server: GET {url}/api/health.
  healthUrl: string
  about: string
  facts: { label: string; value: string }[]
}

export type TaskStatus = 'decide' | 'check' | 'todo' | 'ongoing' | 'later'
export type Task = {
  id: string
  project: ProjectId | 'all'
  title: string
  status: TaskStatus
  owner: 'me' | 'claude'
  priority: 1 | 2 | 3
}

export type Goal = { title: string; project: ProjectId | 'all'; progress: number; next: string }

export const projects: Project[] = [
  {
    id: 'vibely',
    name: 'Vibely',
    domain: 'vibelydate.com',
    healthUrl: 'https://vibelydate.com/api/health',
    about: 'Дейтинг и соцсеть (PWA) для Малайзии',
    facts: [
      { label: 'Стек', value: 'Next.js, Supabase Pro' },
      { label: 'Сервер', value: 'PM2 ×3, Сингапур' },
      { label: 'Модулей', value: '45' },
      { label: 'Миграций', value: '153' },
    ],
  },
  {
    id: 'firtech',
    name: 'Fir Tech',
    domain: 'firtech.pro',
    healthUrl: 'https://firtech.pro/api/health',
    about: 'Сайт студии: сайты, боты, приложения',
    facts: [
      { label: 'Языки', value: 'RU, EN' },
      { label: 'Блог', value: '3 статьи' },
      { label: 'Деплой', value: 'вручную' },
      { label: 'Запуск', value: '16.10.2026' },
    ],
  },
]

export const tasks: Task[] = [
  { id: 'FT-1', project: 'firtech', title: 'GitHub-репозиторий и автодеплой вместо ручного', status: 'todo', owner: 'claude', priority: 1 },
  { id: 'FT-2', project: 'firtech', title: 'Подтвердить цены по каждому формату', status: 'decide', owner: 'me', priority: 1 },
  { id: 'FT-3', project: 'firtech', title: 'Резервная копия leads.json и admin.json', status: 'check', owner: 'claude', priority: 1 },
  { id: 'FT-4', project: 'firtech', title: 'Политика конфиденциальности: просмотр юристом', status: 'decide', owner: 'me', priority: 2 },
  { id: 'FT-5', project: 'firtech', title: 'Новые статьи в блог', status: 'todo', owner: 'claude', priority: 2 },
  { id: 'FT-6', project: 'firtech', title: 'Включить Яндекс Метрику, когда понадобится', status: 'later', owner: 'me', priority: 3 },
  { id: 'VB-1', project: 'vibely', title: 'Юрист в Малайзии (49 вопросов) или остаёмся на Termly', status: 'decide', owner: 'me', priority: 1 },
  { id: 'VB-2', project: 'vibely', title: 'Размер возврата денег при отмене', status: 'decide', owner: 'me', priority: 2 },
  { id: 'VB-3', project: 'vibely', title: 'Открыть регистрацию вместо листа ожидания', status: 'decide', owner: 'me', priority: 1 },
  { id: 'VB-4', project: 'vibely', title: 'Разобрать 2 несмёрженные ветки', status: 'todo', owner: 'claude', priority: 2 },
  { id: 'VB-5', project: 'vibely', title: 'Удалить 170 смёрженных веток', status: 'todo', owner: 'claude', priority: 3 },
  { id: 'VB-6', project: 'vibely', title: 'Когда удалить старый Supabase в Мумбаи', status: 'decide', owner: 'me', priority: 3 },
  { id: 'VB-7', project: 'vibely', title: 'Следить за хранилищем (лимит Pro 100 ГБ)', status: 'ongoing', owner: 'claude', priority: 2 },
  { id: 'WS-1', project: 'all', title: 'Разнести проекты по серверам при росте нагрузки', status: 'later', owner: 'me', priority: 3 },
]

export const goals: Goal[] = [
  { title: 'Запустить Vibely в Малайзии', project: 'vibely', progress: 80, next: 'Регистрация и юридические вопросы' },
  { title: 'Заявки с firtech.pro', project: 'firtech', progress: 70, next: 'Цены, автодеплой, бэкап заявок' },
  { title: 'Клиенты из поиска', project: 'firtech', progress: 30, next: 'Регулярные статьи, аналитика' },
  { title: 'Надёжная инфраструктура', project: 'all', progress: 75, next: 'CI, бэкапы, контроль хранилища' },
]

export const milestones = [
  { date: '2026-10-08', text: 'Первый коммит Vibely' },
  { date: '2026-10-14', text: 'База Vibely переехала в Сингапур' },
  { date: '2026-10-15', text: 'Vibely на трёх процессах PM2' },
  { date: '2026-10-16', text: 'Запущен firtech.pro' },
  { date: '2026-10-17', text: 'Панель /admin и новый конструктор' },
]
