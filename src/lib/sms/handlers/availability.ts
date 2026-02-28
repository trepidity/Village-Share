import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import { rangesOverlap, formatDate } from '@/lib/utils/dates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface AvailabilityContext {
  userId: string
}

/**
 * Handle the AVAILABILITY intent.
 * Searches across all shops the user belongs to, checks current status,
 * active borrows, and upcoming reservations for matching items.
 */
export async function handleAvailability(
  intent: ParsedIntent,
  context: AvailabilityContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return 'What item do you want to check? Text "is [item] available?" to check availability.'
    }

    // Get all shops the user belongs to
    const { data: memberships, error: memberError } = await supabase
      .from('shop_members')
      .select('shop_id, shops!inner(id, name)')
      .eq('user_id', context.userId)

    if (memberError) {
      console.error('Availability membership error:', memberError)
      return templates.error()
    }

    if (!memberships || memberships.length === 0) {
      return templates.noActiveShop()
    }

    const shopIds = memberships.map((m) => m.shop_id)
    const shopMap = new Map(
      memberships.map((m) => {
        const shop = m.shops as unknown as { id: string; name: string }
        return [m.shop_id, shop.name]
      })
    )

    // Search for items across all shops
    const { data: items, error: searchError } = await supabase
      .from('items')
      .select('id, name, status, shop_id')
      .in('shop_id', shopIds)
      .ilike('name', `%${itemName}%`)

    if (searchError) {
      console.error('Availability search error:', searchError)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.availabilityNone(itemName)
    }

    // Single item in a single shop — use detailed single-item response
    if (items.length === 1) {
      const item = items[0]
      const shopName = shopMap.get(item.shop_id) ?? 'your shop'
      return await singleItemAvailability(supabase, item, shopName, intent)
    }

    // Multiple results — build a cross-shop summary
    const results: Array<{ shopName: string; status: string; detail?: string }> = []

    for (const item of items) {
      const shopName = shopMap.get(item.shop_id) ?? 'Unknown shop'

      if (item.status !== 'available') {
        // Check for active borrow with due date
        const { data: activeBorrow } = await supabase
          .from('borrows')
          .select('due_at')
          .eq('item_id', item.id)
          .eq('status', 'active')
          .limit(1)
          .single()

        const detail = activeBorrow?.due_at
          ? `due back ${formatDate(activeBorrow.due_at)}`
          : undefined

        results.push({
          shopName,
          status: `${item.name} - Borrowed`,
          detail,
        })
      } else {
        results.push({
          shopName,
          status: `${item.name} - Available`,
          detail: `text BORROW ${item.name} from ${shopName}`,
        })
      }
    }

    return templates.availabilityCrossShop(itemName, results)
  } catch (err) {
    console.error('Availability handler error:', err)
    return templates.error()
  }
}

/**
 * Detailed availability response for a single item match.
 * Checks borrows, reservations, and optional date range.
 */
async function singleItemAvailability(
  supabase: ReturnType<typeof createAdminClient>,
  item: { id: string; name: string; status: string; shop_id: string },
  shopName: string,
  intent: ParsedIntent
): Promise<string> {
  // Query active borrows
  const { data: activeBorrows } = await supabase
    .from('borrows')
    .select('id, due_at, status')
    .eq('item_id', item.id)
    .in('status', ['requested', 'active'])
    .order('due_at', { ascending: true })

  // Query upcoming reservations
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, starts_at, ends_at, status')
    .eq('item_id', item.id)
    .in('status', ['pending', 'confirmed'])
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  const currentBorrow = activeBorrows?.find((b) => b.status === 'active')
  const upcomingReservations = reservations ?? []

  // Date-specific check
  if (intent.entities.date) {
    const checkStart = new Date(intent.entities.date)
    const checkEnd = intent.entities.dateEnd
      ? new Date(intent.entities.dateEnd)
      : new Date(checkStart.getTime() + 24 * 60 * 60 * 1000)

    const dateRange = intent.entities.dateEnd
      ? `${formatDate(checkStart)} - ${formatDate(checkEnd)}`
      : formatDate(checkStart)

    // Check borrow conflict
    if (currentBorrow?.due_at) {
      const dueAt = new Date(currentBorrow.due_at)
      if (checkStart < dueAt) {
        return templates.availabilityDateConflict(
          item.name,
          `until ${formatDate(dueAt)}`
        )
      }
    }

    // Check reservation conflicts
    const conflict = upcomingReservations.find((r) =>
      rangesOverlap(
        checkStart,
        checkEnd,
        new Date(r.starts_at),
        new Date(r.ends_at)
      )
    )

    if (conflict) {
      return templates.availabilityDateConflict(
        item.name,
        `${formatDate(conflict.starts_at)} - ${formatDate(conflict.ends_at)}`
      )
    }

    return templates.availabilityDateFree(item.name, dateRange)
  }

  // General availability check (no specific date)
  if (currentBorrow) {
    const dueBack = currentBorrow.due_at
      ? formatDate(currentBorrow.due_at)
      : undefined
    let response = templates.availabilityBusy(item.name, dueBack)

    if (upcomingReservations.length > 0) {
      response +=
        '\n' +
        templates.availabilitySchedule(
          item.name,
          upcomingReservations.map((r) => ({
            type: 'Reserved',
            dates: `${formatDate(r.starts_at)} - ${formatDate(r.ends_at)}`,
          }))
        )
    }

    return response
  }

  // Item is available
  if (upcomingReservations.length > 0) {
    return (
      templates.availabilityFree(item.name, shopName) +
      '\n' +
      templates.availabilitySchedule(
        item.name,
        upcomingReservations.map((r) => ({
          type: 'Reserved',
          dates: `${formatDate(r.starts_at)} - ${formatDate(r.ends_at)}`,
        }))
      )
    )
  }

  return templates.availabilityFree(item.name, shopName)
}
