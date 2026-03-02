import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'
import { resolveShopByName } from '@/lib/sms/utils/resolve-shop'
import { handleHelp } from '@/lib/sms/handlers/help'
import { handleSearch } from '@/lib/sms/handlers/search'
import { handleBorrow } from '@/lib/sms/handlers/borrow'
import { handleReturn } from '@/lib/sms/handlers/return'
import { handleStatus } from '@/lib/sms/handlers/status'
import { handleReserve } from '@/lib/sms/handlers/reserve'
import { handleCancel } from '@/lib/sms/handlers/cancel'
import { handleAvailability } from '@/lib/sms/handlers/availability'
import { handleWhoHas } from '@/lib/sms/handlers/who-has'
import { handleAddItem } from '@/lib/sms/handlers/add-item'
import { handleRemoveItem } from '@/lib/sms/handlers/remove-item'

export interface AwaitingChoice {
  options?: Array<{ id: string; name: string }>
  intent_type: string
  shop_id?: string | null
  extra_entities?: Record<string, string>
}

export interface LastIntent {
  awaiting_choice?: AwaitingChoice
}

interface SmsContext {
  userId: string
  phone: string
  activeShopId: string | null
  lastIntent: LastIntent | null
  source?: 'chat' | 'sms'
}

/**
 * Intents that require a shop context to operate.
 */
const SHOP_REQUIRED_INTENTS = new Set([
  'BORROW',
  'RETURN',
  'SEARCH',
  'RESERVE',
  'ADD_ITEM',
  'REMOVE_ITEM',
])

/**
 * Route a parsed intent to the appropriate handler.
 *
 * - Handles pending disambiguation (when lastIntent.awaiting_choice is set
 *   and the user replies with a number).
 * - Resolves shop context when activeShopId is null.
 * - Dispatches to the correct handler based on intent.type.
 */
export async function routeIntent(
  intent: ParsedIntent,
  context: SmsContext
): Promise<string> {
  try {
    // -----------------------------------------------------------------------
    // 1. Handle disambiguation follow-up
    // -----------------------------------------------------------------------
    if (context.lastIntent?.awaiting_choice) {
      // Numeric reply: "1", "2", etc.
      if (intent.entities.choiceIndex != null) {
        return await resolveDisambiguation(
          intent.entities.choiceIndex,
          context
        )
      }

      // Text reply: try to match against the option names
      const textMatch = resolveDisambiguationByName(
        intent.raw,
        context.lastIntent.awaiting_choice
      )
      if (textMatch != null) {
        return await resolveDisambiguation(textMatch, context)
      }
    }

    // -----------------------------------------------------------------------
    // 2. Resolve shop context for intents that need one
    // -----------------------------------------------------------------------
    let shopId = context.activeShopId

    if (SHOP_REQUIRED_INTENTS.has(intent.type)) {
      // If the user specified a shop/owner name, try to resolve it directly
      if (intent.entities.shopName) {
        const byName = await resolveShopByName(
          context.userId,
          intent.entities.shopName
        )
        if (byName) shopId = byName
      }

      // Fall back to generic resolution if still no shop
      if (!shopId) {
        const resolved = await resolveShop(context.userId)

        if (resolved.error) {
          return resolved.error
        }

        shopId = resolved.shopId!
      }
    }

    // -----------------------------------------------------------------------
    // 3. Dispatch to handler
    // -----------------------------------------------------------------------
    switch (intent.type) {
      case 'HELP':
        return await handleHelp()

      case 'STATUS':
        return await handleStatus({ userId: context.userId })

      case 'SEARCH':
        return await handleSearch(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'BORROW':
        return await handleBorrow(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'RETURN':
        return await handleReturn(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'RESERVE':
        return await handleReserve(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'AVAILABILITY':
        return await handleAvailability(intent, {
          userId: context.userId,
        })

      case 'WHO_HAS':
        return await handleWhoHas(intent, {
          userId: context.userId,
        })

      case 'ADD_ITEM':
        return await handleAddItem(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'REMOVE_ITEM':
        return await handleRemoveItem(intent, {
          userId: context.userId,
          shopId: shopId!,
        })

      case 'CANCEL':
        return await handleCancel(intent, { userId: context.userId })

      case 'UNKNOWN':
      default: {
        const admin = createAdminClient()
        await admin.from('unrecognized_messages').insert({
          user_id: context.userId,
          raw_message: intent.raw,
          source: context.source ?? 'sms',
          ai_attempted: intent.confidence > 0,
        })
        return templates.help()
      }
    }
  } catch (err) {
    console.error('Router error:', err)
    return templates.error()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to match a text reply against disambiguation option names.
 * Returns the 1-based index if exactly one option matches, null otherwise.
 */
function resolveDisambiguationByName(
  raw: string,
  awaiting: AwaitingChoice
): number | null {
  const options = awaiting.options ?? []
  if (options.length === 0) return null

  const input = raw.trim().toLowerCase()
  if (!input) return null

  const matches: number[] = []
  for (let i = 0; i < options.length; i++) {
    if (options[i].name.toLowerCase().includes(input)) {
      matches.push(i + 1) // 1-based
    }
  }

  return matches.length === 1 ? matches[0] : null
}

/**
 * Resolve a disambiguation choice.
 * The lastIntent stores the original intent type, entities, and the list
 * of options that were presented to the user.
 */
async function resolveDisambiguation(
  choiceIndex: number,
  context: SmsContext
): Promise<string> {
  const awaiting_choice = context.lastIntent!.awaiting_choice!

  const options: Array<{ id: string; name: string }> =
    awaiting_choice.options ?? []
  const originalType: string = awaiting_choice.intent_type
  const shopId: string | null =
    awaiting_choice.shop_id ?? context.activeShopId

  // Validate choice is in range (1-based)
  if (choiceIndex < 1 || choiceIndex > options.length) {
    return `Please reply with a number between 1 and ${options.length}.`
  }

  const chosen = options[choiceIndex - 1]

  // Re-create an intent with the resolved item and dispatch
  const resolvedIntent: ParsedIntent = {
    type: originalType as ParsedIntent['type'],
    confidence: 1.0,
    entities: {
      itemName: chosen.name,
      ...awaiting_choice.extra_entities,
    },
    raw: String(choiceIndex),
  }

  // Clear awaiting_choice so we don't loop
  const freshContext: SmsContext = {
    ...context,
    activeShopId: shopId,
    lastIntent: null,
  }

  return routeIntent(resolvedIntent, freshContext)
}

/**
 * Try to find the user's shop when activeShopId is null.
 * - If the user belongs to exactly one shop, use it.
 * - If the user belongs to multiple shops, ask them to pick.
 * - If the user belongs to no shops, tell them to join one.
 */
async function resolveShop(
  userId: string
): Promise<{ shopId?: string; error?: string }> {
  const supabase = createAdminClient()

  // Query village_members to get user's villages, then find shops in those villages
  const { data: villageMemberships, error: vmError } = await supabase
    .from('village_members')
    .select('village_id')
    .eq('user_id', userId)

  if (vmError || !villageMemberships || villageMemberships.length === 0) {
    return { error: templates.noActiveShop() }
  }

  const villageIds = villageMemberships.map((vm) => vm.village_id)

  const { data: memberships, error } = await supabase
    .from('shops')
    .select('id, short_name')
    .in('village_id', villageIds)
    .eq('is_active', true)

  if (error) {
    console.error('Shop resolve error:', error)
    return { error: templates.error() }
  }

  if (!memberships || memberships.length === 0) {
    return { error: templates.noActiveShop() }
  }

  if (memberships.length === 1) {
    return { shopId: memberships[0].id }
  }

  // Multiple shops - ask user to pick
  const shopNames = memberships.map((m) => m.short_name)

  return {
    error:
      `You belong to multiple collections. Text "use [name]" to pick one:\n` +
      shopNames.map((n, i) => `${i + 1}. ${n}`).join('\n'),
  }
}
