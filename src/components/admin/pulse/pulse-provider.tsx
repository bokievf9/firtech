'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import type { EchoConsole } from '@/components/admin/echo-console'
import { admin } from '@/content/admin'
import type { PulseData } from '@/lib/pulse-data'
import type { Task, TaskPatch } from '@/lib/pulse-types'
import { TaskDrawer } from './task-drawer'
import { Toast, type ToastMessage } from './toast'
import { useInstagram, type InstagramApi } from './use-instagram'
import { useStats } from './use-stats'
import { useTasks, type TasksApi } from './use-tasks'

const REFRESH_MS = 60_000
const t = admin.pulse.tasks

export type SectionId = 'tasks' | 'leads' | 'numbers' | 'ig'
export type PulseViewData = Omit<PulseData, 'echoLeads'>

type EchoState = {
  // Mounted on the first opening and kept, so a conversation survives closing the panel.
  mounted: boolean
  open: boolean
  question: { id: number; text: string } | null
  ask: (text: string) => void
  show: () => void
  hide: () => void
}

type Context = {
  data: PulseViewData
  echoProps: ComponentProps<typeof EchoConsole>
  tasks: TasksApi
  ig: InstagramApi
  stats: ReturnType<typeof useStats>
  selected: string | null
  openTask: (id: string) => void
  closeTask: () => void
  // Apply a change to a task and offer to take it back for a few seconds.
  change: (task: Task, patch: TaskPatch, message: string) => void
  fail: (message: string) => void
  tab: SectionId
  setTab: (tab: SectionId) => void
  echo: EchoState
}

const PulseContext = createContext<Context | null>(null)

export function usePulse(): Context {
  const ctx = useContext(PulseContext)
  if (!ctx) throw new Error('usePulse must be used inside PulseProvider')
  return ctx
}

// The one place that holds the live state of the Pulse: tasks, the Instagram week, traffic numbers,
// the open task, the Echo panel and the toast. Both views (view-a, view-b) only arrange components
// that read from here, so the views stay thin and either one can be deleted.
export function PulseProvider({
  data,
  echoProps,
  initialTab,
  children,
}: {
  data: PulseViewData
  echoProps: ComponentProps<typeof EchoConsole>
  initialTab: SectionId
  children: React.ReactNode
}) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const counter = useRef(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<SectionId>(initialTab)
  const [echoOpen, setEchoOpen] = useState(false)
  const [echoMounted, setEchoMounted] = useState(false)
  const [question, setQuestion] = useState<{ id: number; text: string } | null>(null)

  const fail = useCallback((text: string) => {
    setToast({ id: ++counter.current, text, tone: 'error' })
  }, [])
  const closeToast = useCallback(() => setToast(null), [])

  const tasks = useTasks(data.snapshot.tasks, fail)
  const ig = useInstagram(data.snapshot.instagram.week, data.snapshot.instagram.days, fail)
  const stats = useStats()
  const { update } = tasks

  const change = useCallback(
    (task: Task, patch: TaskPatch, message: string) => {
      const before: TaskPatch = {}
      for (const key of Object.keys(patch) as (keyof TaskPatch)[]) {
        Object.assign(before, { [key]: task[key] })
      }
      void update(task.id, patch)
      setToast({
        id: ++counter.current,
        text: message,
        tone: 'info',
        action: { label: t.undo, run: () => void update(task.id, before) },
      })
    },
    [update],
  )

  // Sites and lead numbers come from the server: ask for fresh ones once a minute while visible.
  // The task and Instagram lists are edited here, so they are not replaced by the refresh.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [router])

  const echo = useMemo<EchoState>(
    () => ({
      mounted: echoMounted,
      open: echoOpen,
      question,
      show: () => {
        setEchoMounted(true)
        setEchoOpen(true)
      },
      hide: () => setEchoOpen(false),
      ask: (text: string) => {
        setEchoMounted(true)
        setEchoOpen(true)
        setQuestion({ id: ++counter.current, text })
      },
    }),
    [echoMounted, echoOpen, question],
  )

  const ctx = useMemo<Context>(
    () => ({
      data,
      echoProps,
      tasks,
      ig,
      stats,
      selected,
      openTask: setSelected,
      closeTask: () => setSelected(null),
      change,
      fail,
      tab,
      setTab,
      echo,
    }),
    [data, echoProps, tasks, ig, stats, selected, change, fail, tab, echo],
  )

  return (
    <PulseContext value={ctx}>
      {children}
      <Toast message={toast} onClose={closeToast} />
      <TaskDrawer />
    </PulseContext>
  )
}
