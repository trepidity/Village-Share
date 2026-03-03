import { describe, it, expect, vi, beforeEach } from 'vitest'
import { acceptVillageInvite } from './accept'

// ---------------------------------------------------------------------------
// Helpers to build a mock Supabase client
// ---------------------------------------------------------------------------

function createMockClient(overrides: {
  village?: Record<string, unknown> | null
  villageError?: Record<string, unknown> | null
  existingMember?: Record<string, unknown> | null
  insertError?: Record<string, unknown> | null
} = {}) {
  const insertFn = vi.fn().mockResolvedValue({
    error: overrides.insertError ?? null,
  })

  function buildChain(table: string) {
    if (table === 'villages') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: overrides.village !== undefined ? overrides.village : null,
              error: overrides.villageError ?? (overrides.village ? null : { code: 'PGRST116' }),
            }),
          }),
        }),
        insert: insertFn,
      }
    }

    if (table === 'village_members') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.existingMember ?? null,
                error: overrides.existingMember ? null : { code: 'PGRST116' },
              }),
            }),
          }),
        }),
        insert: insertFn,
      }
    }

    return {}
  }

  const from = vi.fn((table: string) => buildChain(table))

  return {
    client: { from } as unknown as Parameters<typeof acceptVillageInvite>[2],
    from,
    insertFn,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VILLAGE = {
  id: 'village-1',
}

const USER_ID = 'new-user-1'

describe('acceptVillageInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('inserts a village member and returns success', async () => {
    const { client, insertFn } = createMockClient({
      village: VILLAGE,
      existingMember: null,
    })

    const result = await acceptVillageInvite('abc123', USER_ID, client!)

    expect(result.success).toBe(true)
    expect(result.villageId).toBe('village-1')

    // Should have inserted the member with 'member' role
    expect(insertFn).toHaveBeenCalledWith({
      village_id: 'village-1',
      user_id: USER_ID,
      role: 'member',
    })
  })

  it('returns failure when invite token is not found', async () => {
    const { client } = createMockClient({
      village: null,
    })

    const result = await acceptVillageInvite('bad-token', USER_ID, client!)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('skips insert if user is already a member', async () => {
    const { client, insertFn } = createMockClient({
      village: VILLAGE,
      existingMember: { id: 'existing-member-1' },
    })

    const result = await acceptVillageInvite('abc123', USER_ID, client!)

    expect(result.success).toBe(true)
    // insert should NOT have been called for village_members
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('returns failure when member insert fails', async () => {
    const { client } = createMockClient({
      village: VILLAGE,
      existingMember: null,
      insertError: { code: '42501', message: 'RLS violation' },
    })

    const result = await acceptVillageInvite('abc123', USER_ID, client!)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/failed/i)
  })
})
