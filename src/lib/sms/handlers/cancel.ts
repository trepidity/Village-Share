import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface CancelContext {
  userId: string
}

/**
 * Handle the CANCEL intent.
 * Find the user's pending or confirmed reservation for the given item
 * and mark it as cancelled.
 */
export async function handleCancel(
  intent: ParsedIntent,
  context: CancelContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      // If no item specified, list active reservations
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('id, starts_at, ends_at, status, items!inner(name)')
        .eq('user_id', context.userId)
        .in('status', ['pending', 'confirmed'])

      if (error || !reservations || reservations.length === 0) {
        return 'You have no active reservations to cancel.'
      }

      const options = reservations.map((r) => {
        const item = r.items as unknown as { name: string }
        return item.name
      })

      return templates.disambiguation('reservation', options)
    }

    // Find user's reservation matching the item name
    const { data: reservations, error: lookupError } = await supabase
      .from('reservations')
      .select('id, starts_at, ends_at, status, items!inner(name)')
      .eq('user_id', context.userId)
      .in('status', ['pending', 'confirmed'])

    if (lookupError) {
      console.error('Cancel lookup error:', lookupError)
      return templates.error()
    }

    if (!reservations || reservations.length === 0) {
      return templates.cancelConfirm(itemName) // no reservations at all
    }

    // Find matching reservation by item name (fuzzy)
    const lowerName = itemName.toLowerCase()
    const matchingReservation = reservations.find((r) => {
      const item = r.items as unknown as { name: string }
      return (
        item.name.toLowerCase().includes(lowerName) ||
        lowerName.includes(item.name.toLowerCase())
      )
    })

    if (!matchingReservation) {
      return `No active reservation found for "${itemName}". Text STATUS to see your borrows.`
    }

    // Update reservation status to cancelled
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', matchingReservation.id)

    if (cancelError) {
      console.error('Cancel update error:', cancelError)
      return templates.error()
    }

    const cancelledItem = (
      matchingReservation.items as unknown as { name: string }
    ).name

    return templates.cancelConfirm(cancelledItem)
  } catch (err) {
    console.error('Cancel handler error:', err)
    return templates.error()
  }
}
