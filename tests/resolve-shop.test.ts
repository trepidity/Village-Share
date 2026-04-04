import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}))

import { resolveShopByName } from '@/lib/sms/utils/resolve-shop'

describe('resolveShopByName', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'village_members') {
        mockSelect.mockReturnValue({
          eq: mockEq.mockResolvedValue({
            data: [{ village_id: 'v1' }],
            error: null,
          }),
        })

        return { select: mockSelect }
      }

      if (table === 'shops') {
        mockSelect.mockReturnValue({
          in: mockIn.mockReturnValue({
            eq: mockEq.mockResolvedValue({
              data: [
                {
                  id: 'shop-1',
                  name: "Jaben's Shop",
                  short_name: 'Jaben',
                  owner_id: 'user-2',
                },
                {
                  id: 'shop-2',
                  name: 'JJ Collection',
                  short_name: 'My Tools',
                  owner_id: 'user-1',
                },
              ],
              error: null,
            }),
          }),
        })

        return { select: mockSelect }
      }

      if (table === 'profiles') {
        mockSelect.mockReturnValue({
          in: mockIn.mockResolvedValue({
            data: [
              { id: 'user-2', display_name: 'Jaben' },
              { id: 'user-1', display_name: 'JJ' },
            ],
          }),
        })

        return { select: mockSelect }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it("resolves possessive shop names like Jaben's shop", async () => {
    await expect(resolveShopByName('user-1', "Jaben's shop")).resolves.toBe(
      'shop-1'
    )
  })

  it('resolves owner shorthand like Jaben', async () => {
    await expect(resolveShopByName('user-1', 'Jaben')).resolves.toBe('shop-1')
  })

  it('resolves "my shop" to the caller-owned shop when unique', async () => {
    await expect(resolveShopByName('user-1', 'my shop')).resolves.toBe('shop-2')
  })
})
