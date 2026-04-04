import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  resolveShopByName: vi.fn(),
  handleReturn: vi.fn(),
  handleHelp: vi.fn(),
  handleStatus: vi.fn(),
  handleSearch: vi.fn(),
  handleBorrow: vi.fn(),
  handleReserve: vi.fn(),
  handleCancel: vi.fn(),
  handleAvailability: vi.fn(),
  handleWhoHas: vi.fn(),
  handleAddItem: vi.fn(),
  handleRemoveItem: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/sms/utils/resolve-shop', () => ({
  resolveShopByName: mocks.resolveShopByName,
}))

vi.mock('@/lib/sms/handlers/return', () => ({
  handleReturn: mocks.handleReturn,
}))

vi.mock('@/lib/sms/handlers/help', () => ({ handleHelp: mocks.handleHelp }))
vi.mock('@/lib/sms/handlers/status', () => ({ handleStatus: mocks.handleStatus }))
vi.mock('@/lib/sms/handlers/search', () => ({ handleSearch: mocks.handleSearch }))
vi.mock('@/lib/sms/handlers/borrow', () => ({ handleBorrow: mocks.handleBorrow }))
vi.mock('@/lib/sms/handlers/reserve', () => ({ handleReserve: mocks.handleReserve }))
vi.mock('@/lib/sms/handlers/cancel', () => ({ handleCancel: mocks.handleCancel }))
vi.mock('@/lib/sms/handlers/availability', () => ({ handleAvailability: mocks.handleAvailability }))
vi.mock('@/lib/sms/handlers/who-has', () => ({ handleWhoHas: mocks.handleWhoHas }))
vi.mock('@/lib/sms/handlers/add-item', () => ({ handleAddItem: mocks.handleAddItem }))
vi.mock('@/lib/sms/handlers/remove-item', () => ({ handleRemoveItem: mocks.handleRemoveItem }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mocks.from,
  }),
}))

import { routeIntent } from '@/lib/sms/router'

describe('RETURN routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleReturn.mockResolvedValue('returned')
    mocks.from.mockReturnValue({ insert: mocks.insert })
    mocks.insert.mockResolvedValue({ error: null })
  })

  it('uses locationName as shop context for RETURN when it resolves', async () => {
    mocks.resolveShopByName.mockImplementation(async (_userId: string, name: string) => {
      if (name === "jaben's shop") return 'shop-jaben'
      return null
    })

    const reply = await routeIntent(
      {
        type: 'RETURN',
        confidence: 1,
        entities: {
          itemName: "16' trailer",
          locationName: "jaben's shop",
        },
        raw: "return 16' trailer at Jaben's shop",
      },
      {
        userId: 'user-1',
        phone: '+15555555555',
        activeShopId: null,
        lastIntent: null,
        source: 'chat',
      }
    )

    expect(mocks.handleReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: expect.objectContaining({
          itemName: "16' trailer",
          locationName: "jaben's shop",
        }),
      }),
      expect.objectContaining({
        userId: 'user-1',
        shopId: 'shop-jaben',
      })
    )
    expect(reply).toBe('returned')
  })
})
