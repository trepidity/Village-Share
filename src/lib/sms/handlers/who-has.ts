import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import { formatDate } from '@/lib/utils/dates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface WhoHasContext {
  userId: string
}

/**
 * Handle the WHO_HAS intent.
 * Searches across all shops in the user's villages for an item,
 * then returns who currently has it borrowed (if anyone).
 */
export async function handleWhoHas(
  intent: ParsedIntent,
  context: WhoHasContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const itemName = intent.entities.itemName

    if (!itemName) {
      return 'Who has what? Text "WHO HAS [item]" to find out who borrowed something.'
    }

    // Get all shops in user's villages
    const { data: villageMemberships, error: vmError } = await supabase
      .from('village_members')
      .select('village_id')
      .eq('user_id', context.userId)

    if (vmError || !villageMemberships || villageMemberships.length === 0) {
      return templates.noActiveShop()
    }

    const villageIds = villageMemberships.map((vm) => vm.village_id)

    const { data: shops, error: shopError } = await supabase
      .from('shops')
      .select('id, short_name')
      .in('village_id', villageIds)
      .eq('is_active', true)

    if (shopError) {
      console.error('WHO_HAS shop error:', shopError)
      return templates.error()
    }

    if (!shops || shops.length === 0) {
      return templates.noActiveShop()
    }

    const shopIds = shops.map((s) => s.id)
    const shopMap = new Map(shops.map((s) => [s.id, s.short_name]))

    // Search for items by name across all shops (fuzzy: all words must match in any order)
    let query = supabase
      .from('items')
      .select('id, name, shop_id')
      .in('shop_id', shopIds)

    const words = itemName.split(/\s+/).filter(Boolean)
    for (const word of words) {
      query = query.ilike('name', `%${word}%`)
    }

    const { data: items, error: searchError } = await query

    if (searchError) {
      console.error('WHO_HAS search error:', searchError)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.availabilityNone(itemName)
    }

    // Batch fetch all active borrows for matched items
    const itemIds = items.map((i) => i.id)
    const { data: activeBorrows } = await supabase
      .from('borrows')
      .select('item_id, borrower_id, due_at')
      .in('item_id', itemIds)
      .eq('status', 'active')

    // Index borrows by item_id for quick lookup
    const borrowByItem = new Map(
      (activeBorrows ?? []).map((b) => [b.item_id, b])
    )

    // Batch fetch all unique borrower profiles
    const borrowerIds = [
      ...new Set((activeBorrows ?? []).map((b) => b.borrower_id)),
    ]
    const profileMap = new Map<
      string,
      { display_name: string | null; phone: string | null }
    >()
    if (borrowerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, phone')
        .in('id', borrowerIds)
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p)
      }
    }

    // Build results from the pre-fetched data
    const results: Array<{
      itemName: string
      shopName: string
      borrowerName?: string
      borrowerPhone?: string
      dueAt?: string
    }> = []

    for (const item of items) {
      const shopName = shopMap.get(item.shop_id) ?? 'Unknown shop'
      const borrow = borrowByItem.get(item.id)

      if (borrow) {
        const profile = profileMap.get(borrow.borrower_id)
        results.push({
          itemName: item.name,
          shopName,
          borrowerName: profile?.display_name ?? 'Someone',
          borrowerPhone: profile?.phone ?? undefined,
          dueAt: borrow.due_at ? formatDate(borrow.due_at) : undefined,
        })
      } else {
        results.push({ itemName: item.name, shopName })
      }
    }

    // Single item match — use simple template
    if (results.length === 1) {
      const r = results[0]
      if (r.borrowerName) {
        return templates.whoHasBorrower(
          r.itemName,
          r.borrowerName,
          r.borrowerPhone,
          r.dueAt
        )
      }
      return templates.whoHasNobody(r.itemName)
    }

    // Multiple matches — cross-shop listing
    return templates.whoHasMultiple(itemName, results)
  } catch (err) {
    console.error('WHO_HAS handler error:', err)
    return templates.error()
  }
}
