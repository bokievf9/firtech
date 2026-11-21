import { CalendarView } from '@/components/admin/hq/calendar-view'

export const metadata = { title: 'HQ · Calendar' }

// The layout above is dynamic, so «today» is read per request and the grid opens on the current week.
export default function Page() {
  return <CalendarView initialDay={new Date().toISOString().slice(0, 10)} />
}
