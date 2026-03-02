import {
  Wrench,
  ChefHat,
  Scissors,
  BookOpen,
  Warehouse,
  Shirt,
  PartyPopper,
  Box,
} from 'lucide-react'
import type { CollectionType } from '@/lib/supabase/types'

const iconMap: Record<CollectionType, React.ComponentType<{ className?: string }>> = {
  workshop: Wrench,
  kitchen: ChefHat,
  craft_room: Scissors,
  library: BookOpen,
  garage: Warehouse,
  closet: Shirt,
  party_supplies: PartyPopper,
  general: Box,
}

export function CollectionIcon({
  type,
  className,
}: {
  type: CollectionType
  className?: string
}) {
  const Icon = iconMap[type] ?? Box
  return <Icon className={className} />
}
