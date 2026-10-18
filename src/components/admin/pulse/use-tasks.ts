'use client'

import { useCallback, useState } from 'react'
import { admin } from '@/content/admin'
import type { NewTask, ProjectId, Task, TaskPatch } from '@/lib/pulse-types'
import { api, ApiError, taskScope } from './api'

const e = admin.pulse.tasks.errors
const message = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback

// Live task list for the Pulse home. Changes show at once and roll back with a message when the
// server refuses; `pending` holds the ids that are waiting for an answer.
export function useTasks(initial: Task[]) {
  const [tasks, setTasks] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState(false)

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
      const before = tasks.find((t) => t.id === id)
      if (!before) return
      setError(null)
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
        setError(message(error, e.save))
      } finally {
        mark(id, false)
      }
    },
    [mark, tasks],
  )

  const add = useCallback(async (project: ProjectId, title: string): Promise<boolean> => {
    setError(null)
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
      setError(message(error, e.add))
      return false
    } finally {
      setAdding(false)
    }
  }, [])

  const remove = useCallback(
    async (id: string) => {
      const index = tasks.findIndex((t) => t.id === id)
      const before = tasks[index]
      if (!before) return
      setError(null)
      mark(id, true)
      setTasks((list) => list.filter((t) => t.id !== id))
      try {
        await api<{ ok: true }>(
          `/api/admin/tasks/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
          taskScope,
          e.remove,
        )
      } catch (error) {
        setTasks((list) => [...list.slice(0, index), before, ...list.slice(index)])
        setError(message(error, e.remove))
      } finally {
        mark(id, false)
      }
    },
    [mark, tasks],
  )

  const clearError = useCallback(() => setError(null), [])

  return { tasks, error, clearError, pending, adding, update, add, remove }
}

export type TasksApi = ReturnType<typeof useTasks>
