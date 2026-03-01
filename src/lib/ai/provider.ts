/**
 * Two-tier parsing provider.
 *
 * Called when the rule-based SMS parser returns low confidence (< 0.3).
 * Uses Gemini as an AI fallback to attempt to understand the message.
 */

import type { ParsedIntent, IntentType } from '../sms/intents'
import { callGemini } from './gemini'
import { SMS_PARSE_SYSTEM_PROMPT, SMS_PARSE_USER_PROMPT } from './prompts'

/** The set of valid intent types the AI is allowed to return. */
const VALID_INTENTS = new Set<IntentType>([
  'BORROW',
  'RETURN',
  'SEARCH',
  'RESERVE',
  'STATUS',
  'HELP',
  'CANCEL',
  'AVAILABILITY',
  'WHO_HAS',
  'ADD_ITEM',
  'REMOVE_ITEM',
  'UNKNOWN',
])

interface GeminiParseResponse {
  intent?: string
  entities?: {
    itemName?: string | null
    shopName?: string | null
    date?: string | null
    dateEnd?: string | null
  }
}

/**
 * Attempt to parse an SMS message using the Gemini AI model.
 *
 * Returns a ParsedIntent with confidence 0.6 on success, or UNKNOWN with
 * confidence 0 if the AI call fails or returns an unusable response.
 */
export async function parseWithAI(message: string): Promise<ParsedIntent> {
  const fallback: ParsedIntent = {
    type: 'UNKNOWN',
    confidence: 0,
    entities: {},
    raw: message,
  }

  try {
    const raw = await callGemini(
      SMS_PARSE_SYSTEM_PROMPT,
      SMS_PARSE_USER_PROMPT(message)
    )

    if (!raw) {
      return fallback
    }

    const parsed: GeminiParseResponse = JSON.parse(raw)

    // Validate that the intent is one of our known types
    const intent = parsed.intent?.toUpperCase() as IntentType | undefined
    if (!intent || !VALID_INTENTS.has(intent)) {
      return fallback
    }

    // Build a clean entities object, dropping nulls
    const entities: ParsedIntent['entities'] = {}

    if (parsed.entities?.itemName) {
      entities.itemName = String(parsed.entities.itemName)
    }
    if (parsed.entities?.shopName) {
      entities.shopName = String(parsed.entities.shopName)
    }
    if (parsed.entities?.date) {
      entities.date = String(parsed.entities.date)
    }
    if (parsed.entities?.dateEnd) {
      entities.dateEnd = String(parsed.entities.dateEnd)
    }

    return {
      type: intent,
      confidence: 0.6,
      entities,
      raw: message,
    }
  } catch (err) {
    console.error('AI parse failed:', err)
    return fallback
  }
}
