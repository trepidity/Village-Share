import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedIntent } from '@/lib/sms/intents'

// --- Chainable Supabase mock ---

function createChainMock() {
  const state: {
    table: string
    filters: Array<{ method: string; args: unknown[] }>
    result: { data: unknown; error: unknown }
  } = {
    table: '',
    filters: [],
    result: { data: null, error: null },
  }

  const chain: Record<string, unknown> = {}

  const chainMethods = [
    'select',
    'eq',
    'in',
    'ilike',
    'order',
    'limit',
    'gte',
  ]

  for (const method of chainMethods) {
    chain[method] = vi.fn((...args: unknown[]) => {
      state.filters.push({ method, args })
      return chain
    })
  }

  chain.single = vi.fn(() => {
    return Promise.resolve(state.result)
  })

  // Make the chain itself thenable so `const { data, error } = await query` works
  chain.then = (resolve: (v: unknown) => void) => {
    return Promise.resolve(state.result).then(resolve)
  }

  return { chain, state }
}

// Store table configs so tests can set results per table
const tableResults = new Map<
  string,
  Array<{ match?: (filters: Array<{ method: string; args: unknown[] }>) => boolean; data: unknown; error?: unknown }>
>()

function setTableResult(
  table: string,
  data: unknown,
  error?: unknown,
  match?: (filters: Array<{ method: string; args: unknown[] }>) => boolean
) {
  if (!tableResults.has(table)) {
    tableResults.set(table, [])
  }
  tableResults.get(table)!.push({ match, data, error })
}

function clearTableResults() {
  tableResults.clear()
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      const { chain, state } = createChainMock()
      state.table = table

      // Override then/single to resolve with table-specific results
      const resolveResult = (filters: Array<{ method: string; args: unknown[] }>) => {
        const entries = tableResults.get(table) ?? []
        for (const entry of entries) {
          if (!entry.match || entry.match(filters)) {
            return { data: entry.data, error: entry.error ?? null }
          }
        }
        return { data: null, error: null }
      }

      chain.single = vi.fn(() => {
        return Promise.resolve(resolveResult(state.filters))
      })

      chain.then = (resolve: (v: unknown) => void) => {
        return Promise.resolve(resolveResult(state.filters)).then(resolve)
      }

      return chain
    },
  })),
}))

import { handleSearch } from '@/lib/sms/handlers/search'
import { templates } from '@/lib/sms/templates'

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    type: 'SEARCH',
    confidence: 1.0,
    entities: {},
    raw: 'search',
    ...overrides,
  }
}

describe('Search handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearTableResults()
  })

  describe('single-shop search (shopId provided)', () => {
    it('returns search results for a query', async () => {
      setTableResult('shops', { short_name: 'Tools' })
      setTableResult('items', [
        { id: '1', name: 'OBD2 Scanner', status: 'available' },
        { id: '2', name: 'OBD2 Reader', status: 'borrowed' },
      ])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'OBD2' }, raw: 'search OBD2' }),
        { userId: 'user-1', shopId: 'shop-1' }
      )

      expect(result).toContain('OBD2 Scanner')
      expect(result).toContain('OBD2 Reader')
    })

    it('returns no items found for empty results', async () => {
      setTableResult('shops', { short_name: 'Tools' })
      setTableResult('items', [])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'nonexistent' }, raw: 'search nonexistent' }),
        { userId: 'user-1', shopId: 'shop-1' }
      )

      expect(result).toContain('No items found matching "nonexistent"')
      expect(result).not.toContain('any of your collections')
    })

    it('lists all items when no query given', async () => {
      setTableResult('shops', { short_name: 'Tools' })
      setTableResult('items', [
        { id: '1', name: 'Drill', status: 'available' },
        { id: '2', name: 'Saw', status: 'borrowed' },
      ])

      const result = await handleSearch(
        makeIntent({ raw: 'search' }),
        { userId: 'user-1', shopId: 'shop-1' }
      )

      expect(result).toContain('Items in Tools:')
      expect(result).toContain('Drill')
      expect(result).toContain('Saw')
    })
  })

  describe('cross-shop search (no shopId)', () => {
    it('returns results from multiple collections', async () => {
      setTableResult('village_members', [{ village_id: 'v1' }, { village_id: 'v2' }])
      setTableResult('shops', [
        { id: 'shop-a', short_name: 'Garage Tools' },
        { id: 'shop-b', short_name: 'Kitchen Stuff' },
      ])
      setTableResult('items', [
        { id: '1', name: 'OBD2 Scanner', status: 'available', shop_id: 'shop-a' },
        { id: '2', name: 'OBD2 Reader', status: 'borrowed', shop_id: 'shop-b' },
      ])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'OBD2' }, raw: 'search OBD2' }),
        { userId: 'user-1' }
      )

      expect(result).toContain('Results for "OBD2"')
      expect(result).toContain('[Garage Tools]')
      expect(result).toContain('[Kitchen Stuff]')
      expect(result).toContain('OBD2 Scanner')
      expect(result).toContain('OBD2 Reader')
    })

    it('returns cross-shop not-found message when no results', async () => {
      setTableResult('village_members', [{ village_id: 'v1' }])
      setTableResult('shops', [
        { id: 'shop-a', short_name: 'Garage Tools' },
        { id: 'shop-b', short_name: 'Kitchen Stuff' },
      ])
      setTableResult('items', [])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'nonexistent' }, raw: 'search nonexistent' }),
        { userId: 'user-1' }
      )

      expect(result).toContain('No items found matching "nonexistent"')
      expect(result).toContain('any of your collections')
    })

    it('uses simpler format for single result across shops', async () => {
      setTableResult('village_members', [{ village_id: 'v1' }])
      setTableResult('shops', [
        { id: 'shop-a', short_name: 'Garage Tools' },
        { id: 'shop-b', short_name: 'Kitchen Stuff' },
      ])
      setTableResult('items', [
        { id: '1', name: 'OBD2 Scanner', status: 'available', shop_id: 'shop-a' },
      ])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'OBD2' }, raw: 'search OBD2' }),
        { userId: 'user-1' }
      )

      // Single result uses searchResults (simpler format), not searchResultsCrossShop
      expect(result).toContain('Items in Garage Tools:')
      expect(result).toContain('OBD2 Scanner')
      expect(result).not.toContain('[Garage Tools]')
    })

    it('falls through to single-shop when user has one shop', async () => {
      setTableResult('village_members', [{ village_id: 'v1' }])
      // Only 1 shop — triggers single-shop fallback
      setTableResult('shops', [{ id: 'shop-a', short_name: 'My Tools' }])
      setTableResult('items', [
        { id: '1', name: 'Drill', status: 'available' },
      ])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'Drill' }, raw: 'search Drill' }),
        { userId: 'user-1' }
      )

      // Single-shop format (no cross-shop brackets)
      expect(result).toContain('Items in')
      expect(result).toContain('Drill')
      expect(result).not.toContain('[')
    })

    it('lists items across collections when no query given', async () => {
      setTableResult('village_members', [{ village_id: 'v1' }])
      setTableResult('shops', [
        { id: 'shop-a', short_name: 'Garage Tools' },
        { id: 'shop-b', short_name: 'Kitchen Stuff' },
      ])
      setTableResult('items', [
        { id: '1', name: 'Drill', status: 'available', shop_id: 'shop-a' },
        { id: '2', name: 'Mixer', status: 'available', shop_id: 'shop-b' },
      ])

      const result = await handleSearch(
        makeIntent({ raw: 'search' }),
        { userId: 'user-1' }
      )

      expect(result).toContain('Items across your collections:')
      expect(result).toContain('[Garage Tools]')
      expect(result).toContain('[Kitchen Stuff]')
    })

    it('returns noActiveShop when user has no villages', async () => {
      setTableResult('village_members', [])

      const result = await handleSearch(
        makeIntent({ entities: { itemName: 'OBD2' }, raw: 'search OBD2' }),
        { userId: 'user-1' }
      )

      expect(result).toBe(templates.noActiveShop())
    })
  })
})

describe('searchResultsCrossShop template', () => {
  it('formats results with shop names', () => {
    const result = templates.searchResultsCrossShop('OBD2', [
      { shopName: 'Garage', name: 'OBD2 Scanner', status: 'available' },
      { shopName: 'Auto', name: 'OBD2 Reader', status: 'borrowed' },
    ])

    expect(result).toContain('Results for "OBD2":')
    expect(result).toContain('- OBD2 Scanner (available) [Garage]')
    expect(result).toContain('- OBD2 Reader (borrowed) [Auto]')
  })

  it('shows overflow message when more than 8 results', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      shopName: `Shop ${i}`,
      name: `Item ${i}`,
      status: 'available',
    }))

    const result = templates.searchResultsCrossShop('tools', items)

    expect(result).toContain('...and 2 more')
    expect(result).toContain('Text SEARCH [term] to narrow results.')
  })

  it('uses generic header when no query', () => {
    const result = templates.searchResultsCrossShop(undefined, [
      { shopName: 'Tools', name: 'Drill', status: 'available' },
    ])

    expect(result).toContain('Items across your collections:')
  })
})

describe('noItemsFound template with crossShop flag', () => {
  it('shows cross-shop message with query', () => {
    const result = templates.noItemsFound('drill', true)
    expect(result).toBe('No items found matching "drill" in any of your collections.')
  })

  it('shows cross-shop message without query', () => {
    const result = templates.noItemsFound(undefined, true)
    expect(result).toBe('No items found in any of your collections right now.')
  })

  it('shows single-shop message by default', () => {
    const result = templates.noItemsFound('drill')
    expect(result).toContain('No items found matching "drill"')
    expect(result).toContain('Try SEARCH')
  })
})
