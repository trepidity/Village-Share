import type { ParsedIntent } from '@/lib/sms/intents'
import type { Json } from '@/lib/supabase/types'

export type { LastIntent, AwaitingChoice } from '@/lib/sms/router'

/**
 * Build the last_intent JSON to persist in session state.
 * If the response text contains a numbered disambiguation list,
 * we store the awaiting_choice state so the next numeric reply
 * can be resolved by the router.
 */
export function buildLastIntentState(
  intent: ParsedIntent,
  responseText: string
): Json | null {
  // Check if the response looks like a disambiguation list
  // Pattern: numbered lines like "1. Item name"
  const lines = responseText.split('\n')
  const numberedLines = lines.filter((line) => /^\d+\.\s/.test(line.trim()))

  if (numberedLines.length >= 2) {
    // Extract option names from numbered lines
    const options = numberedLines.map((line) => {
      const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(.+\))?$/)
      const name = match ? match[1].trim() : line.replace(/^\d+\.\s+/, '').trim()
      return { id: '', name }
    })

    return {
      awaiting_choice: {
        intent_type: intent.type,
        options,
        extra_entities: {
          date: intent.entities.date,
          dateEnd: intent.entities.dateEnd,
        },
        shop_id: null, // will use session's activeShopId as fallback
      },
    }
  }

  // No disambiguation - clear the state
  return null
}
