import 'server-only'
import type { NewTask, Task, TaskPatch } from './pulse-types'

// STUB of the contract: the `pulse-data` branch replaces this file with the real store
// ($DATA_DIR/tasks.json, safe writes like store.ts). Signatures must not change.
export async function listTasks(): Promise<Task[]> {
  return []
}
export async function createTask(_input: NewTask): Promise<Task> {
  throw new Error('tasks-store: not implemented')
}
export async function updateTask(_id: string, _patch: TaskPatch): Promise<Task | null> {
  throw new Error('tasks-store: not implemented')
}
export async function deleteTask(_id: string): Promise<boolean> {
  throw new Error('tasks-store: not implemented')
}
