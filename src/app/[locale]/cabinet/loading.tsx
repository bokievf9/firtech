import { ViewTransition } from 'react'
import { RouteLoading } from '@/components/ui/route-states'

// The spinner fades out when the page arrives (docs/motion-storyboard.md section 4, Suspense fallbacks), it does not pop.
export default function Loading() {
  return (
    <ViewTransition exit="pt-loading" default="none">
      <RouteLoading />
    </ViewTransition>
  )
}
