import type { ParsedIntent } from '@/lib/sms/intents'
import type { AwaitingChoice, LastIntent } from '@/lib/sms/router'
import type { Json } from '@/lib/supabase/types'
import { resolveShopByName } from '@/lib/sms/utils/resolve-shop'

export type { LastIntent, AwaitingChoice } from '@/lib/sms/router'

/**
 * Build the last_intent JSON to persist in session state.
 * If the response text contains a numbered disambiguation list,
 * we store the awaiting_choice state so the next numeric reply
 * can be resolved by the router.
 */
export function buildLastIntentState(
  intent: ParsedIntent,
  responseText: string,
  context?: {
    shopId?: string | null
  }
): Json | null {
  // Check if the response looks like a disambiguation list
  // Pattern: numbered lines like "1. Item name"
  const lines = responseText.split('\n')
  const numberedLines = lines.filter((line) => /^\d+\.\s/.test(line.trim()))

  if (numberedLines.length >= 2) {
    const isShopChoice = responseText.toLowerCase().includes('multiple collections')

    // Extract option names from numbered lines
    const parsedOptions = numberedLines.map((line) => {
      const match = line.match(/^\d+\.\s+(.+?)(?:\s+\(.+\))?$/)
      const name = match ? match[1].trim() : line.replace(/^\d+\.\s+/, '').trim()
      return { id: '', name }
    })

    return {
      awaiting_choice: {
        intent_type: intent.type,
        options: parsedOptions,
        extra_entities: {
          itemName: intent.entities.itemName,
          locationName: intent.entities.locationName,
          date: intent.entities.date,
          dateEnd: intent.entities.dateEnd,
        },
        shop_id: context?.shopId ?? null,
        choice_kind: isShopChoice ? 'shop' : 'item',
      },
    }
  }

  // No disambiguation - clear the state
  return null
}

function resolveChoiceIndex(
  intent: ParsedIntent,
  awaitingChoice: AwaitingChoice
): number | null {
  if (intent.entities.choiceIndex != null) {
    return intent.entities.choiceIndex
  }

  const options = awaitingChoice.options ?? []
  if (options.length === 0) return null

  const input = intent.raw.trim().toLowerCase()
  if (!input) return null

  const matches: number[] = []
  for (let i = 0; i < options.length; i++) {
    if (options[i].name.toLowerCase().includes(input)) {
      matches.push(i + 1)
    }
  }

  return matches.length === 1 ? matches[0] : null
}

export async function resolveNextActiveShopId(
  intent: ParsedIntent,
  context: {
    userId: string
    activeShopId: string | null
    lastIntent: LastIntent | null
  }
): Promise<string | null> {
  const awaitingChoice = context.lastIntent?.awaiting_choice
  if (
    !awaitingChoice ||
    awaitingChoice.choice_kind !== 'shop' ||
    !Array.isArray(awaitingChoice.options)
  ) {
    return context.activeShopId
  }

  const choiceIndex = resolveChoiceIndex(intent, awaitingChoice)
  if (choiceIndex == null) {
    return context.activeShopId
  }

  const chosenOption = awaitingChoice.options[choiceIndex - 1]
  if (!chosenOption) {
    return context.activeShopId
  }

  if (chosenOption.id) {
    return chosenOption.id
  }

  if (!chosenOption.name) {
    return context.activeShopId
  }

  return (
    (await resolveShopByName(context.userId, chosenOption.name)) ??
    context.activeShopId
  )
}
