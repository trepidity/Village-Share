import type { CollectionType } from '@/lib/supabase/types'

export const COLLECTION_TYPES: Record<
  CollectionType,
  { label: string; description: string }
> = {
  workshop: {
    label: 'Workshop',
    description: 'Power tools, hand tools, and building supplies',
  },
  kitchen: {
    label: 'Kitchen',
    description: 'Appliances, cookware, and baking supplies',
  },
  craft_room: {
    label: 'Craft Room',
    description: 'Sewing machines, art supplies, and craft tools',
  },
  library: {
    label: 'Library',
    description: 'Books, board games, and media',
  },
  garage: {
    label: 'Garage',
    description: 'Automotive tools, yard equipment, and outdoor gear',
  },
  closet: {
    label: 'Closet',
    description: 'Clothing, costumes, and accessories',
  },
  party_supplies: {
    label: 'Party Supplies',
    description: 'Decorations, tables, chairs, and event gear',
  },
  general: {
    label: 'General',
    description: 'A mixed collection of shared items',
  },
}

export function getCollectionLabel(type: CollectionType): string {
  return COLLECTION_TYPES[type]?.label ?? 'Collection'
}

export const COLLECTION_TYPE_OPTIONS: Array<{
  value: CollectionType
  label: string
  description: string
}> = [
  { value: 'workshop', ...COLLECTION_TYPES.workshop },
  { value: 'kitchen', ...COLLECTION_TYPES.kitchen },
  { value: 'craft_room', ...COLLECTION_TYPES.craft_room },
  { value: 'library', ...COLLECTION_TYPES.library },
  { value: 'garage', ...COLLECTION_TYPES.garage },
  { value: 'closet', ...COLLECTION_TYPES.closet },
  { value: 'party_supplies', ...COLLECTION_TYPES.party_supplies },
  { value: 'general', ...COLLECTION_TYPES.general },
]
