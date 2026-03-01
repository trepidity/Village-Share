import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface AddItemContext {
  userId: string
  shopId: string
}

/**
 * Handle the ADD_ITEM intent.
 * Only shop owners can add items. Checks for duplicates before inserting.
 */
export async function handleAddItem(
  intent: ParsedIntent,
  context: AddItemContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return templates.addItemPrompt()
    }

    // Verify user is the shop owner
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('id, owner_id, short_name')
      .eq('id', context.shopId)
      .single()

    if (shopError || !shop) {
      console.error('ADD_ITEM shop lookup error:', shopError)
      return templates.error()
    }

    if (shop.owner_id !== context.userId) {
      return templates.addItemNotOwner()
    }

    // Check for duplicate item name in this shop
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('shop_id', context.shopId)
      .ilike('name', itemName)
      .limit(1)

    if (existing && existing.length > 0) {
      return templates.addItemDuplicate(itemName, shop.short_name)
    }

    // Insert the new item
    const { error: insertError } = await supabase
      .from('items')
      .insert({
        shop_id: context.shopId,
        name: itemName,
        status: 'available',
      })

    if (insertError) {
      console.error('ADD_ITEM insert error:', insertError)
      return templates.error()
    }

    return templates.addItemConfirm(itemName, shop.short_name)
  } catch (err) {
    console.error('ADD_ITEM handler error:', err)
    return templates.error()
  }
}
