import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface RemoveItemContext {
  userId: string
  shopId: string
}

/**
 * Handle the REMOVE_ITEM intent.
 * Only shop owners can remove items. Items that are currently borrowed cannot be removed.
 */
export async function handleRemoveItem(
  intent: ParsedIntent,
  context: RemoveItemContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return templates.removeItemPrompt()
    }

    // Verify user is the shop owner
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, owner_id, short_name')
      .eq('id', context.shopId)
      .single()

    if (shopError || !shop) {
      console.error('REMOVE_ITEM shop lookup error:', shopError)
      return templates.error()
    }

    if (shop.owner_id !== context.userId) {
      return templates.removeItemNotOwner()
    }

    // Search for item by name in this shop
    const { data: items, error: searchError } = await supabase
      .from('items')
      .select('id, name, status')
      .eq('shop_id', context.shopId)
      .ilike('name', `%${itemName}%`)

    if (searchError) {
      console.error('REMOVE_ITEM search error:', searchError)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.itemNotFound(itemName)
    }

    // Multiple matches — disambiguation
    if (items.length > 1) {
      return templates.disambiguation(
        'item',
        items.map((i) => i.name)
      )
    }

    const item = items[0]

    // Check if item is currently borrowed
    if (item.status === 'borrowed') {
      return templates.removeItemBorrowed(item.name)
    }

    // Delete the item
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id)

    if (deleteError) {
      console.error('REMOVE_ITEM delete error:', deleteError)
      return templates.error()
    }

    return templates.removeItemConfirm(item.name, shop.short_name)
  } catch (err) {
    console.error('REMOVE_ITEM handler error:', err)
    return templates.error()
  }
}
