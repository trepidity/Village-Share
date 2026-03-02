import { describe, it, expect } from 'vitest'
import { buildLastIntentState } from '@/lib/sms/session'
import type { ParsedIntent } from '@/lib/sms/intents'

function makeIntent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    type: 'SEARCH',
    confidence: 0.8,
    entities: {},
    raw: 'test',
    ...overrides,
  }
}

describe('buildLastIntentState', () => {
  it('returns null for a plain response with no numbered list', () => {
    const intent = makeIntent()
    const response = 'No items found matching "drill".'
    expect(buildLastIntentState(intent, response)).toBeNull()
  })

  it('returns null for a response with only one numbered line', () => {
    const intent = makeIntent()
    const response = 'Results:\n1. Drill'
    expect(buildLastIntentState(intent, response)).toBeNull()
  })

  it('detects disambiguation when response has 2+ numbered lines', () => {
    const intent = makeIntent({ type: 'BORROW' })
    const response = 'I found 3 items:\n1. Drill\n2. Hammer\n3. Saw\nReply with a number to pick one.'
    const result = buildLastIntentState(intent, response)

    expect(result).not.toBeNull()
    const state = result as Record<string, unknown>
    expect(state.awaiting_choice).toBeDefined()

    const awaiting = state.awaiting_choice as Record<string, unknown>
    expect(awaiting.intent_type).toBe('BORROW')
    expect(awaiting.options).toEqual([
      { id: '', name: 'Drill' },
      { id: '', name: 'Hammer' },
      { id: '', name: 'Saw' },
    ])
  })

  it('preserves date entities in extra_entities', () => {
    const intent = makeIntent({
      type: 'RESERVE',
      entities: { date: '2026-03-10', dateEnd: '2026-03-12' },
    })
    const response = '1. Drill\n2. Saw'
    const result = buildLastIntentState(intent, response) as Record<string, unknown>
    const awaiting = result.awaiting_choice as Record<string, unknown>
    const extra = awaiting.extra_entities as Record<string, unknown>

    expect(extra.date).toBe('2026-03-10')
    expect(extra.dateEnd).toBe('2026-03-12')
  })

  it('strips parenthetical status from option names', () => {
    const intent = makeIntent()
    const response = '1. Drill (available)\n2. Saw (borrowed)'
    const result = buildLastIntentState(intent, response) as Record<string, unknown>
    const awaiting = result.awaiting_choice as Record<string, unknown>
    const options = awaiting.options as Array<{ name: string }>

    expect(options[0].name).toBe('Drill')
    expect(options[1].name).toBe('Saw')
  })

  it('sets shop_id to null', () => {
    const intent = makeIntent()
    const response = '1. Drill\n2. Saw'
    const result = buildLastIntentState(intent, response) as Record<string, unknown>
    const awaiting = result.awaiting_choice as Record<string, unknown>

    expect(awaiting.shop_id).toBeNull()
  })

  it('detects "multiple shops" response as disambiguation', () => {
    const intent = makeIntent({ type: 'BORROW' })
    const response =
      'You belong to multiple shops. Text "use [shop name]" to pick one:\n1. Jared\'s Tools\n2. Daniel\'s Garage'
    const result = buildLastIntentState(intent, response) as Record<string, unknown>

    expect(result).not.toBeNull()
    const awaiting = result.awaiting_choice as Record<string, unknown>
    expect(awaiting.intent_type).toBe('BORROW')
    const options = awaiting.options as Array<{ name: string }>
    expect(options).toHaveLength(2)
    expect(options[0].name).toBe("Jared's Tools")
    expect(options[1].name).toBe("Daniel's Garage")
  })
})
