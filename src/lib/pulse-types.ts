// Shared contract of the owner's one-screen panel ("Пульт", /admin). Three branches build on it in
// parallel: data (stores, API, scripts), ui (the /admin home) and echo (tool use, voice). Change a
// type here only together with all three. Russian copy only (owner tool), no em or en dashes.

export type ProjectId = 'firtech' | 'vibely' | 'tools' | 'instagram'
export const projectIds: readonly ProjectId[] = ['firtech', 'vibely', 'tools', 'instagram']

// Live tasks (replace the typed list in src/content/control.ts for tasks; projects and goals stay there).
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done' // blocked = waiting for the owner
export type TaskPriority = 'high' | 'normal' | 'low'
export type Task = {
  id: string // "t" + base36 time + random, assigned by the store
  project: ProjectId
  title: string // 1..200 chars
  status: TaskStatus
  priority: TaskPriority
  due: string | null // YYYY-MM-DD
  notes: string // 0..2000 chars
  source: 'import' | 'ui' | 'echo'
  createdAt: string // ISO
  updatedAt: string // ISO
  doneAt: string | null // ISO, set when status becomes done
}
export type NewTask = Pick<Task, 'project' | 'title'> &
  Partial<Pick<Task, 'status' | 'priority' | 'due' | 'notes' | 'source'>>
export type TaskPatch = Partial<Pick<Task, 'project' | 'title' | 'status' | 'priority' | 'due' | 'notes'>>

// Instagram: the posting calendar (seeded from marketing/instagram/publish/schedule.md) and daily numbers typed by hand.
export type IgKind = 'post' | 'stories' | 'reel' | 'task'
export type IgItem = {
  id: string // stable, e.g. "2026-10-19-1000-01_post_intro"
  date: string // YYYY-MM-DD, Dushanbe
  time: string // HH:MM, Dushanbe (UTC+5)
  kind: IgKind
  title: string
  folder: string | null // publish/<folder>
  note: string
  published: boolean
  publishedAt: string | null // ISO
}
export type IgDay = { date: string; followers: number | null; reach: number | null }

// What the home page shows, assembled on the server from the stores and the existing admin data.
export type SiteStatus = { id: 'firtech' | 'vibely'; name: string; ok: boolean; ms: number | null }
export type PulseSnapshot = {
  now: string // ISO
  sites: SiteStatus[]
  tasks: Task[]
  leads: { today: number; week: number; month: number; funnel: Record<string, number>; upcoming: number; stale: number }
  instagram: { next: IgItem[]; days: IgDay[] }
}

// HTTP API (all under /api/admin, session cookie + same-origin POST rules of src/lib/admin-guard.ts).
//   GET    /api/admin/tasks                  -> { tasks: Task[] }
//   POST   /api/admin/tasks        NewTask   -> { task: Task }
//   PATCH  /api/admin/tasks/:id    TaskPatch -> { task: Task }
//   DELETE /api/admin/tasks/:id              -> { ok: true }
//   GET    /api/admin/instagram              -> { items: IgItem[]; days: IgDay[] }
//   PATCH  /api/admin/instagram/items/:id    { published: boolean } -> { item: IgItem }
//   PUT    /api/admin/instagram/days         IgDay -> { day: IgDay }
