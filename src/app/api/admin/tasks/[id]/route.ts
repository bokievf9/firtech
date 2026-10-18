import 'server-only'
import { guard } from '@/lib/admin-guard'
import { invalid, json, notFound, readJson } from '@/lib/admin-json'
import { deleteTask, taskPatchSchema, updateTask } from '@/lib/tasks-store'

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Context) {
  const denied = await guard(request)
  if (denied) return denied
  const parsed = taskPatchSchema.safeParse(await readJson(request))
  if (!parsed.success) return invalid()
  const task = await updateTask((await context.params).id, parsed.data)
  return task ? json({ task }) : notFound()
}

export async function DELETE(request: Request, context: Context) {
  const denied = await guard(request)
  if (denied) return denied
  return (await deleteTask((await context.params).id)) ? json({ ok: true }) : notFound()
}
