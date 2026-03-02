import { describe, it, expect, vi, beforeEach } from 'vitest'
import { acceptVillageInvite } from './accept'

// ---------------------------------------------------------------------------
// Helpers to build a mock Supabase client
// ---------------------------------------------------------------------------

function createMockClient(overrides: {
  invite?: Record<string, unknown> | null
  inviteError?: Record<string, unknown> | null
  existingMember?: Record<string, unknown> | null
  insertError?: Record<string, unknown> | null
} = {}) {
  const insertFn = vi.fn().mockResolvedValue({
    error: overrides.insertError ?? null,
  })

  // Track calls per table for assertions
  const fromCalls: Record<string, ReturnType<typeof buildChain>> = {}

  function buildChain(table: string) {
    if (table === 'village_invites') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: overrides.invite !== undefined ? overrides.invite : null,
                error: overrides.inviteError ?? (overrides.invite ? null : { code: 'PGRST116' }),
              }),
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

  const from = vi.fn((table: string) => {
    const chain = buildChain(table)
    fromCalls[table] = chain
    return chain
  })

  return {
    client: { from } as unknown as Parameters<typeof acceptVillageInvite>[2],
    from,
    insertFn,
    fromCalls,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VALID_INVITE = {
  id: 'invite-1',
  village_id: 'village-1',
  invited_by: 'owner-1',
  token: 'abc-123',
  role: 'member' as const,
  accepted_at: null,
  expires_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  created_at: new Date().toISOString(),
}

const USER_ID = 'new-user-1'

describe('acceptVillageInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('inserts a village member and returns success', async () => {
    const { client, insertFn } = createMockClient({
      invite: VALID_INVITE,
      existingMember: null,
    })

    const result = await acceptVillageInvite('abc-123', USER_ID, client!)

    expect(result.success).toBe(true)
    expect(result.villageId).toBe('village-1')

    // Should have inserted the member
    expect(insertFn).toHaveBeenCalledWith({
      village_id: 'village-1',
      user_id: USER_ID,
      role: 'member',
    })
  })

  it('returns failure when invite is not found', async () => {
    const { client } = createMockClient({
      invite: null,
    })

    const result = await acceptVillageInvite('bad-token', USER_ID, client!)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found|expired/i)
  })

  it('skips insert if user is already a member', async () => {
    const { client, insertFn } = createMockClient({
      invite: VALID_INVITE,
      existingMember: { id: 'existing-member-1' },
    })

    const result = await acceptVillageInvite('abc-123', USER_ID, client!)

    expect(result.success).toBe(true)
    // insert should NOT have been called for village_members
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('returns failure when member insert fails', async () => {
    const { client } = createMockClient({
      invite: VALID_INVITE,
      existingMember: null,
      insertError: { code: '42501', message: 'RLS violation' },
    })

    const result = await acceptVillageInvite('abc-123', USER_ID, client!)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/failed/i)
  })
})
