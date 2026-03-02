import { describe, it, expect } from 'vitest'
import { getCollectionLabel, COLLECTION_TYPES, COLLECTION_TYPE_OPTIONS } from '@/lib/collections'
import type { CollectionType } from '@/lib/supabase/types'

describe('Collection utilities', () => {
  const allTypes: CollectionType[] = [
    'workshop',
    'kitchen',
    'craft_room',
    'library',
    'garage',
    'closet',
    'party_supplies',
    'general',
  ]

  describe('COLLECTION_TYPES', () => {
    it('has entries for all collection types', () => {
      for (const type of allTypes) {
        expect(COLLECTION_TYPES[type]).toBeDefined()
        expect(COLLECTION_TYPES[type].label).toBeTruthy()
        expect(COLLECTION_TYPES[type].description).toBeTruthy()
      }
    })
  })

  describe('getCollectionLabel', () => {
    it('returns "Workshop" for workshop', () => {
      expect(getCollectionLabel('workshop')).toBe('Workshop')
    })

    it('returns "Kitchen" for kitchen', () => {
      expect(getCollectionLabel('kitchen')).toBe('Kitchen')
    })

    it('returns "Craft Room" for craft_room', () => {
      expect(getCollectionLabel('craft_room')).toBe('Craft Room')
    })

    it('returns "Library" for library', () => {
      expect(getCollectionLabel('library')).toBe('Library')
    })

    it('returns "Garage" for garage', () => {
      expect(getCollectionLabel('garage')).toBe('Garage')
    })

    it('returns "Closet" for closet', () => {
      expect(getCollectionLabel('closet')).toBe('Closet')
    })

    it('returns "Party Supplies" for party_supplies', () => {
      expect(getCollectionLabel('party_supplies')).toBe('Party Supplies')
    })

    it('returns "General" for general', () => {
      expect(getCollectionLabel('general')).toBe('General')
    })
  })

  describe('COLLECTION_TYPE_OPTIONS', () => {
    it('has the same number of entries as allTypes', () => {
      expect(COLLECTION_TYPE_OPTIONS).toHaveLength(allTypes.length)
    })

    it('includes every type', () => {
      const values = COLLECTION_TYPE_OPTIONS.map((o) => o.value)
      for (const type of allTypes) {
        expect(values).toContain(type)
      }
    })
  })
})
