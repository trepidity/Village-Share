import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface BorrowContext {
  userId: string
  shopId: string
}

/**
 * Handle the BORROW intent.
 * Look up item by name (fuzzy match), check availability,
 * create a borrow record, update item status, and notify the shop owner.
 */
export async function handleBorrow(
  intent: ParsedIntent,
  context: BorrowContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return 'What item would you like to borrow? Text BORROW [item name].'
    }

    // Fuzzy match items in the shop (all words must match in any order)
    let itemQuery = supabase
      .from('items')
      .select('id, name, status, shop_id, location_shop_id')
      .eq('shop_id', context.shopId)

    for (const word of itemName.split(/\s+/).filter(Boolean)) {
      itemQuery = itemQuery.ilike('name', `%${word}%`)
    }

    const { data: items, error: searchError } = await itemQuery

    if (searchError) {
      console.error('Borrow search error:', searchError)
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

    // Check availability
    if (item.status !== 'available') {
      return templates.itemUnavailable(item.name, item.status)
    }

    // Calculate due date (2 weeks from now)
    const now = new Date()
    const dueAt = new Date(now)
    dueAt.setDate(dueAt.getDate() + 14)

    // Claim the item before inserting the borrow so concurrent requests cannot
    // both proceed on the same "available" read.
    const { data: claimedItems, error: claimError } = await supabase
      .from('items')
      .update({ status: 'borrowed' })
      .eq('id', item.id)
      .eq('status', 'available')
      .select('id')

    if (claimError) {
      console.error('Item claim error:', claimError)
      return templates.error()
    }

    if (!claimedItems || claimedItems.length === 0) {
      return templates.itemUnavailable(item.name, 'borrowed')
    }

    // Create the borrow after the claim succeeds. Roll back the item status if
    // the insert fails so item and borrow state stay aligned.
    const { error: borrowError } = await supabase.from('borrows').insert({
      item_id: item.id,
      borrower_id: context.userId,
      from_shop_id: context.shopId,
      status: 'active',
      borrowed_at: now.toISOString(),
      due_at: dueAt.toISOString(),
    })

    if (borrowError) {
      console.error('Borrow insert error:', borrowError)

      const { error: rollbackError } = await supabase
        .from('items')
        .update({ status: 'available' })
        .eq('id', item.id)
        .eq('status', 'borrowed')

      if (rollbackError) {
        console.error('Borrow rollback error:', rollbackError)
      }

      return templates.error()
    }

    // Get shop info and borrower profile in parallel
    const [{ data: shop }, { data: borrowerProfile }] = await Promise.all([
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

    const borrowerName =
      borrowerProfile?.display_name ?? borrowerProfile?.phone ?? 'Someone'

    // Queue notification to shop owner
    if (shop?.owner_id && shop.owner_id !== context.userId) {
      await supabase.from('notifications').insert({
        user_id: shop.owner_id,
        body: `${borrowerName} borrowed "${item.name}" from ${shop.short_name}.`,
        channel: 'sms',
      })
    }

    // Check if item is at a different location than its home shop
    let pickupLocation: string | undefined
    if (item.location_shop_id && item.location_shop_id !== item.shop_id) {
      const { data: locationShop } = await supabase
        .from('shops')
        .select('short_name')
        .eq('id', item.location_shop_id)
        .single()
      pickupLocation = locationShop?.short_name
    }

    return templates.borrowConfirm(item.name, shop?.short_name ?? 'your collection', pickupLocation)
  } catch (err) {
    console.error('Borrow handler error:', err)
    return templates.error()
  }
}
