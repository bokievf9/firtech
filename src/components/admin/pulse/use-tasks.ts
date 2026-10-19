'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { admin } from '@/content/admin'
import type { NewTask, ProjectId, Task, TaskPatch } from '@/lib/pulse-types'
import { api, ApiError, taskScope } from './api'

const e = admin.pulse.tasks.errors
const message = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback

// Live task list for the Pulse. Changes show at once and roll back with a message (`onError`) when
// the server refuses; `pending` holds the ids that are waiting for an answer.
export function useTasks(initial: Task[], onError: (message: string, retry?: () => void) => void) {
  const [tasks, setTasks] = useState(initial)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState(false)
  // Always the latest list, so a callback made earlier (an undo) never works from an old copy.
  const latest = useRef(tasks)
  useEffect(() => {
    latest.current = tasks
  }, [tasks])

  // The newest versions of the actions, so a "Retry" made earlier runs the current code.
  const actions = useRef<{
    update: (id: string, patch: TaskPatch) => Promise<void>
    add: (project: ProjectId, title: string) => Promise<boolean>
    remove: (id: string) => Promise<void>
  } | null>(null)

  const mark = useCallback((id: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const update = useCallback(
    async (id: string, patch: TaskPatch) => {
      const before = latest.current.find((t) => t.id === id)
      if (!before) return
      mark(id, true)
      setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      try {
        const { task } = await api<{ task: Task }>(
          `/api/admin/tasks/${encodeURIComponent(id)}`,
          { method: 'PATCH', body: patch },
          taskScope,
          e.save,
        )
        setTasks((list) => list.map((t) => (t.id === id ? task : t)))
      } catch (error) {
        setTasks((list) => list.map((t) => (t.id === id ? before : t)))
        onError(message(error, e.save), () => void actions.current?.update(id, patch))
      } finally {
        mark(id, false)
      }
    },
    [mark, onError],
  )

  const add = useCallback(
    async (project: ProjectId, title: string): Promise<boolean> => {
      setAdding(true)
      const body: NewTask = { project, title, source: 'ui' }
      try {
        const { task } = await api<{ task: Task }>(
          '/api/admin/tasks',
          { method: 'POST', body },
          taskScope,
          e.add,
        )
        setTasks((list) => [...list, task])
        return true
      } catch (error) {
        onError(message(error, e.add), () => void actions.current?.add(project, title))
        return false
      } finally {
        setAdding(false)
      }
    },
    [onError],
  )

  const remove = useCallback(
    async (id: string) => {
      const list = latest.current
      const index = list.findIndex((t) => t.id === id)
      const before = list[index]
      if (!before) return
      mark(id, true)
      setTasks((l) => l.filter((t) => t.id !== id))
      try {
        await api<{ ok: true }>(
          `/api/admin/tasks/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          taskScope,
          e.remove,
        )
      } catch (error) {
        setTasks((l) => [...l.slice(0, index), before, ...l.slice(index)])
        onError(message(error, e.remove), () => void actions.current?.remove(id))
      } finally {
        mark(id, false)
      }
    },
    [mark, onError],
  )

  // Echo can add or change tasks on the server; this picks the changes up.
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tasks', { cache: 'no-store' })
      if (!res.ok) throw new Error('bad status')
      const body = (await res.json()) as { tasks: Task[] }
      setTasks(body.tasks)
    } catch {
      onError(e.load)
    }
  }, [onError])

  useEffect(() => {
    actions.current = { update, add, remove }
  }, [update, add, remove])

  return { tasks, pending, adding, update, add, remove, reload }
}

export type TasksApi = ReturnType<typeof useTasks>
