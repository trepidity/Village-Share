import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
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
    const itemName = intent.entities.itemName

    if (!itemName) {
      return 'What item are you returning? Text RETURN [item name].'
    }

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
      return templates.itemNotFound(itemName)
    }

    // Find borrow matching the item name (fuzzy)
    const lowerName = itemName.toLowerCase()
    const matchingBorrow = borrows.find((b) => {
      const item = b.items as unknown as { id: string; name: string; shop_id: string }
      return item.name.toLowerCase().includes(lowerName) ||
        lowerName.includes(item.name.toLowerCase())
    })

    if (!matchingBorrow) {
      return `You don't have an active borrow for "${itemName}". Text STATUS to see your borrows.`
    }

    const matchedItem = matchingBorrow.items as unknown as {
      id: string
      name: string
      shop_id: string
    }

    // Update borrow record
    const { error: updateBorrowError } = await supabase
      .from('borrows')
      .update({
        status: 'returned',
        returned_at: new Date().toISOString(),
      })
      .eq('id', matchingBorrow.id)

    if (updateBorrowError) {
      console.error('Return borrow update error:', updateBorrowError)
      return templates.error()
    }

    // Update item status back to available
    const { error: updateItemError } = await supabase
      .from('items')
      .update({ status: 'available' })
      .eq('id', matchedItem.id)

    if (updateItemError) {
      console.error('Return item update error:', updateItemError)
      // Borrow was updated, still confirm
    }

    // Get shop info for notification
    const { data: shop } = await supabase
      .from('shops')
      .select('name, owner_id')
      .eq('id', context.shopId)
      .single()

    // Get returner display name
    const { data: returnerProfile } = await supabase
      .from('profiles')
      .select('display_name, phone')
      .eq('id', context.userId)
      .single()

    const returnerName =
      returnerProfile?.display_name ?? returnerProfile?.phone ?? 'Someone'

    // Queue notification to shop owner
    if (shop?.owner_id && shop.owner_id !== context.userId) {
      await supabase.from('notifications').insert({
        user_id: shop.owner_id,
        body: `${returnerName} returned "${matchedItem.name}" to ${shop?.name ?? 'your shop'}.`,
        channel: 'sms',
      })
    }

    return templates.returnConfirm(matchedItem.name)
  } catch (err) {
    console.error('Return handler error:', err)
    return templates.error()
  }
}
