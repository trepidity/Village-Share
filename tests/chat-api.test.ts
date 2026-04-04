import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks (must be before imports) ---

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: mockSelect }),
  })),
}))

vi.mock('@/lib/sms/parser', () => ({
  parseMessage: vi.fn((msg: string) => ({
    type: msg.toLowerCase() === 'help' ? 'HELP' : 'UNKNOWN',
    confidence: msg.toLowerCase() === 'help' ? 1.0 : 0,
    entities: {},
    raw: msg,
  })),
}))

vi.mock('@/lib/sms/router', () => ({
  routeIntent: vi.fn(async (intent: { type: string }) => {
    if (intent.type === 'HELP') return 'VillageShare commands:\nBORROW [item] - borrow an item'
    return 'I didn\'t understand that. Text HELP for a list of commands.'
  }),
}))

vi.mock('@/lib/sms/session', () => ({
  buildLastIntentState: vi.fn(() => null),
}))

// --- Import after mocks ---

import { POST } from '@/app/api/chat/route'
import { NextRequest } from 'next/server'

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/chat POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@test.com' } },
    })
    // Profile lookup chain
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { phone: '+15551234567' } })
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await POST(makeRequest({ message: 'help' }))
    expect(res.status).toBe(401)

    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Message required')
  })

  it('returns 400 when message is empty string', async () => {
    const res = await POST(makeRequest({ message: '   ' }))
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.error).toBe('Message required')
  })

  it('returns a reply for a valid message', async () => {
    const res = await POST(makeRequest({ message: 'help' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.reply).toContain('VillageShare commands')
    expect(body).toHaveProperty('activeShopId')
    expect(body).toHaveProperty('lastIntent')
  })

  it('passes activeShopId through', async () => {
    const res = await POST(
      makeRequest({ message: 'help', activeShopId: 'shop-abc' })
    )
    const body = await res.json()
    expect(body.activeShopId).toBe('shop-abc')
  })

  it('passes lastIntent through to routeIntent', async () => {
    const { routeIntent } = await import('@/lib/sms/router')

    await POST(
      makeRequest({
        message: 'help',
        activeShopId: 'shop-1',
        lastIntent: { awaiting_choice: { intent_type: 'SEARCH', options: [] } },
      })
    )

    expect(routeIntent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        userId: 'user-123',
        activeShopId: 'shop-1',
        lastIntent: { awaiting_choice: { intent_type: 'SEARCH', options: [] } },
      })
    )
  })

  it('defaults activeShopId to null when not provided', async () => {
    const res = await POST(makeRequest({ message: 'help' }))
    const body = await res.json()
    expect(body.activeShopId).toBeNull()
  })

  it('passes source: "chat" to routeIntent', async () => {
    const { routeIntent } = await import('@/lib/sms/router')

    await POST(makeRequest({ message: 'help' }))

    expect(routeIntent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ source: 'chat' })
    )
  })

  it('updates activeShopId after a shop-choice reply', async () => {
    const { parseMessage } = await import('@/lib/sms/parser')
    const { buildLastIntentState } = await import('@/lib/sms/session')

    vi.mocked(parseMessage).mockReturnValue({
      type: 'UNKNOWN',
      confidence: 1,
      entities: { choiceIndex: 3 },
      raw: '3',
    })
    vi.mocked(buildLastIntentState).mockReturnValue(null)

    const res = await POST(
      makeRequest({
        message: '3',
        activeShopId: null,
        lastIntent: {
          awaiting_choice: {
            intent_type: 'RETURN',
            choice_kind: 'shop',
            options: [
              { id: 'shop-1', name: 'One' },
              { id: 'shop-2', name: 'Two' },
              { id: 'shop-3', name: 'Three' },
            ],
          },
        },
      })
    )

    const body = await res.json()
    expect(body.activeShopId).toBe('shop-3')
  })
})
