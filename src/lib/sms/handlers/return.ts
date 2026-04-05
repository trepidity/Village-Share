import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import { resolveShopByName } from '@/lib/sms/utils/resolve-shop'
import type { ParsedIntent } from '@/lib/sms/intents'

interface ReturnContext {
  userId: string
  shopId: string
}

/**
 * Handle the RETURN intent.
 * Find the user's active borrow for the given item, mark it returned,
 * update item status back to available, and notify the shop owner.
 */
export async function handleReturn(
  intent: ParsedIntent,
  context: ReturnContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    let itemName = intent.entities.itemName

    // Find the user's active borrows, joining with items to match by name
    const { data: borrows, error: borrowError } = await supabase
      .from('borrows')
      .select('id, item_id, from_shop_id, items!inner(id, name, shop_id)')
      .eq('borrower_id', context.userId)
      .eq('status', 'active')
      .eq('from_shop_id', context.shopId)

    if (borrowError) {
      console.error('Return lookup error:', borrowError)
      return templates.error()
    }

    if (!borrows || borrows.length === 0) {
      return templates.itemNotFound(itemName ?? 'that item')
    }

    if (!itemName) {
      if (borrows.length === 1) {
        itemName = (borrows[0].items as unknown as {
          id: string
          name: string
          shop_id: string
        }).name
      } else {
        return 'What item are you returning? Text RETURN [item name].'
      }
    }

    // Find borrow matching the item name (fuzzy, all words in any order)
    const words = itemName.toLowerCase().split(/\s+/).filter(Boolean)
    const matchingBorrow = borrows.find((b) => {
      const name = (b.items as unknown as { id: string; name: string; shop_id: string }).name.toLowerCase()
      return words.every((w) => name.includes(w))
    })

    if (!matchingBorrow) {
      return `You don't have an active borrow for "${itemName}". Text STATUS to see your borrows.`
    }

    const matchedItem = matchingBorrow.items as unknown as {
      id: string
      name: string
      shop_id: string
    }

    // Resolve return location
    let locationShopId = matchingBorrow.from_shop_id // default: back to origin
    let locationShopName: string | undefined

    if (intent.entities.locationName) {
      const resolvedLocationId = await resolveShopByName(
        context.userId,
        intent.entities.locationName
      )
      if (resolvedLocationId) {
        locationShopId = resolvedLocationId
        // Get the location shop short_name for SMS confirmation
        const { data: locationShop } = await supabase
          .from('shops')
          .select('short_name')
          .eq('id', resolvedLocationId)
          .single()
        locationShopName = locationShop?.short_name
      }
    }

    // Update the active borrow first. The extra status guard prevents a stale
    // second return from mutating an already-closed borrow.
    const returnedAt = new Date().toISOString()
    const { data: updatedBorrows, error: updateBorrowError } = await supabase
      .from('borrows')
      .update({
        status: 'returned',
        returned_at: returnedAt,
        return_shop_id: locationShopId,
      })
      .eq('id', matchingBorrow.id)
      .eq('status', 'active')
      .select('id')

    if (updateBorrowError) {
      console.error('Return borrow update error:', updateBorrowError)
      return templates.error()
    }

    if (!updatedBorrows || updatedBorrows.length === 0) {
      return `The ${matchedItem.name} is no longer checked out. Text STATUS to see your active borrows.`
    }

    // Update item status back to available and set physical location. If this
    // fails, roll the borrow back to active so the two records stay aligned.
    const { error: updateItemError } = await supabase
      .from('items')
      .update({ status: 'available', location_shop_id: locationShopId })
      .eq('id', matchedItem.id)

    if (updateItemError) {
      console.error('Return item update error:', updateItemError)

      const { error: rollbackError } = await supabase
        .from('borrows')
        .update({
          status: 'active',
          returned_at: null,
          return_shop_id: null,
        })
        .eq('id', matchingBorrow.id)

      if (rollbackError) {
        console.error('Return rollback error:', rollbackError)
      }

      return templates.error()
    }

    // Get shop info and returner profile in parallel
    const [{ data: shop }, { data: returnerProfile }] = await Promise.all([
      supabase
        .from('shops')
        .select('short_name, owner_id')
        .eq('id', context.shopId)
        .single(),
      supabase
        .from('profiles')
        .select('display_name, phone')
        .eq('id', context.userId)
        .single(),
    ])

    const returnerName =
      returnerProfile?.display_name ?? returnerProfile?.phone ?? 'Someone'

    // Queue notification to shop owner
    if (shop?.owner_id && shop.owner_id !== context.userId) {
      const locationNote = locationShopName
        ? ` It's at ${locationShopName}.`
        : ''
      await supabase.from('notifications').insert({
        user_id: shop.owner_id,
        body: `${returnerName} returned "${matchedItem.name}" to ${shop?.short_name ?? 'your collection'}.${locationNote}`,
        channel: 'sms',
      })
    }

    return templates.returnConfirm(matchedItem.name, locationShopName)
  } catch (err) {
    console.error('Return handler error:', err)
    return templates.error()
  }
}
