import {
  Buildings,
  CalendarCheck,
  DeviceMobile,
  FlowArrow,
  Headset,
  Newspaper,
  UserCircle,
} from '@phosphor-icons/react/ssr'
import type { Icon } from '@phosphor-icons/react'
import type { ProductId } from '@/lib/products'

// One glyph per product, shared by the hero stage, the bento and the footer.
export const productIcons: Record<ProductId, Icon> = {
  personal: UserCircle,
  company: Buildings,
  admin: CalendarCheck,
  receptionist: Headset,
  automation: FlowArrow,
  content: Newspaper,
  miniapp: DeviceMobile,
}
