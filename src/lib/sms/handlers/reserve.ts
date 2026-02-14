import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import { rangesOverlap } from '@/lib/utils/dates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface ReserveContext {
  userId: string
  shopId: string
}

/**
 * Handle the RESERVE intent.
 * Look up item by name, check for conflicts with existing reservations
 * and blackout periods, then create a reservation record.
 */
export async function handleReserve(
  intent: ParsedIntent,
  context: ReserveContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return 'What item would you like to reserve? Text RESERVE [item name] for [date].'
    }

    if (!intent.entities.date) {
      return 'Please include a date. Example: RESERVE hammer for Feb 20'
    }

    // Parse date range
    const startsAt = new Date(intent.entities.date)
    const endsAt = intent.entities.dateEnd
      ? new Date(intent.entities.dateEnd)
      : new Date(startsAt.getTime() + 24 * 60 * 60 * 1000) // default 1 day

    // Find the item by name (fuzzy match)
    const { data: items, error: searchError } = await supabase
      .from('items')
      .select('id, name, status')
      .eq('shop_id', context.shopId)
      .ilike('name', `%${itemName}%`)

    if (searchError) {
      console.error('Reserve search error:', searchError)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.itemNotFound(itemName)
    }

    // Multiple matches - return disambiguation
    if (items.length > 1) {
      return templates.disambiguation(
        'item',
        items.map((i) => `${i.name} (${i.status})`)
      )
    }

    const item = items[0]

    // Check for blackout periods
    const { data: blackouts } = await supabase
      .from('blackout_periods')
      .select('starts_at, ends_at, reason')
      .eq('shop_id', context.shopId)
      .or(`item_id.eq.${item.id},item_id.is.null`)

    if (blackouts && blackouts.length > 0) {
      const conflictingBlackout = blackouts.find((bo) =>
        rangesOverlap(
          startsAt,
          endsAt,
          new Date(bo.starts_at),
          new Date(bo.ends_at)
        )
      )

      if (conflictingBlackout) {
        return `"${item.name}" is unavailable during that period${conflictingBlackout.reason ? `: ${conflictingBlackout.reason}` : '. Try different dates.'}`
      }
    }

    // Check for conflicting reservations
    const { data: existingReservations } = await supabase
      .from('reservations')
      .select('starts_at, ends_at')
      .eq('item_id', item.id)
      .in('status', ['pending', 'confirmed'])

    if (existingReservations && existingReservations.length > 0) {
      const conflict = existingReservations.find((r) =>
        rangesOverlap(
          startsAt,
          endsAt,
          new Date(r.starts_at),
          new Date(r.ends_at)
        )
      )

      if (conflict) {
        return templates.reserveConflict(item.name)
      }
    }

    // Create reservation
    const { error: insertError } = await supabase.from('reservations').insert({
      item_id: item.id,
      user_id: context.userId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: 'pending',
    })

    if (insertError) {
      console.error('Reserve insert error:', insertError)
      return templates.error()
    }

    const dateStr = intent.entities.dateEnd
      ? `${startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return templates.reserveConfirm(item.name, dateStr)
  } catch (err) {
    console.error('Reserve handler error:', err)
    return templates.error()
  }
}
