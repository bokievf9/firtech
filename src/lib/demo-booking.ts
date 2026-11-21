import type { Dict } from '@/content'

// The booking dialogue of the «ИИ-администратор» demo tab (#demo, owner 2026-11-22): a small state
// machine over the dictionary's `demoSection.admin` copy. It is a sample script, labelled «Пример»:
// nothing is booked and nothing is sent. Pure functions, covered by tests/front-v3.test.mjs.
export type BookingCopy = Dict['demoSection']['admin']

export type BookingStep =
  | 'service'
  | 'master'
  | 'time'
  | 'confirm'
  | 'reminder'
  | 'review-ask'
  | 'review'
  | 'end'

export type BookingMessage = { from: 'agent' | 'client'; text: string }

export type BookingState = {
  step: BookingStep
  service: string
  master: string
  time: string
  log: BookingMessage[]
}

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')

export function bookingStart(copy: BookingCopy): BookingState {
  return { step: 'service', service: '', master: '', time: '', log: [{ from: 'agent', text: copy.greet }] }
}

// The choices the visitor can press at this step.
export function bookingOptions(state: BookingState, copy: BookingCopy): string[] {
  switch (state.step) {
    case 'service':
      return [...copy.services]
    case 'master':
      return [...copy.masters]
    case 'time':
      return [...copy.times]
    case 'confirm':
      return [copy.showReminder]
    case 'reminder':
      return [copy.yes, copy.move]
    case 'review-ask':
      return [copy.showReview]
    case 'review':
      return [copy.good, copy.fair]
    case 'end':
      return [copy.restart]
  }
}

// Press option `index` of the current step; an index out of range changes nothing.
export function bookingNext(state: BookingState, index: number, copy: BookingCopy): BookingState {
  const options = bookingOptions(state, copy)
  const choice = options[index]
  if (choice === undefined) return state
  const say = (step: BookingStep, agent: string | null, patch: Partial<BookingState> = {}): BookingState => ({
    ...state,
    ...patch,
    step,
    log: [...state.log, { from: 'client', text: choice }, ...(agent ? [{ from: 'agent' as const, text: agent }] : [])],
  })
  switch (state.step) {
    case 'service':
      return say('master', copy.askMaster, { service: choice })
    case 'master':
      return say('time', copy.askTime, { master: choice })
    case 'time':
      return say(
        'confirm',
        fill(copy.confirm, { service: state.service.toLowerCase(), master: state.master, time: choice }),
        { time: choice },
      )
    case 'confirm':
      return say('reminder', fill(copy.reminder, { time: state.time }))
    case 'reminder':
      return index === 0 ? say('review-ask', copy.thanks) : say('review-ask', copy.moved)
    case 'review-ask':
      return say('review', copy.review)
    case 'review':
      return say('end', `${index === 0 ? copy.goodReply : copy.fairReply} ${copy.end}`)
    case 'end':
      return bookingStart(copy)
  }
}
