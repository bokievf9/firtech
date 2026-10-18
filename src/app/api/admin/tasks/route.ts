import 'server-only'
import { guard } from '@/lib/admin-guard'
import { invalid, json, readJson } from '@/lib/admin-json'
import { createTask, listTasks, newTaskSchema } from '@/lib/tasks-store'

export async function GET(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  return json({ tasks: await listTasks() })
}

export async function POST(request: Request) {
  const denied = await guard(request)
  if (denied) return denied
  const parsed = newTaskSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid()
  return json({ task: await createTask(parsed.data) })
}
