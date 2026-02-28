import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface SearchContext {
  userId: string
  shopId: string
}

/**
 * Handle the SEARCH intent.
 * If an itemName entity is provided, do a fuzzy search using ilike.
 * Otherwise, list all available items in the shop.
 */
export async function handleSearch(
  intent: ParsedIntent,
  context: SearchContext
): Promise<string> {
  try {
    const supabase = createAdminClient()
    const query = intent.entities.itemName

    // Get the shop short_name for SMS display
    const { data: shop } = await supabase
      .from('shops')
      .select('short_name')
      .eq('id', context.shopId)
      .single()

    const shopName = shop?.short_name ?? 'your shop'

    if (query) {
      // Fuzzy search by item name
      const { data: items, error } = await supabase
        .from('items')
        .select('id, name, status')
        .eq('shop_id', context.shopId)
        .ilike('name', `%${query}%`)

      if (error) {
        console.error('Search error:', error)
        return templates.error()
      }

      if (!items || items.length === 0) {
        return templates.noItemsFound(query)
      }

      if (items.length === 1) {
        return templates.searchResults(
          items.map((i) => ({ name: i.name, status: i.status })),
          shopName
        )
      }

      // Multiple results - return disambiguation list
      return templates.disambiguation(
        'item',
        items.map((i) => `${i.name} (${i.status})`)
      )
    }

    // No query - list all items in the shop
    const { data: items, error } = await supabase
      .from('items')
      .select('id, name, status')
      .eq('shop_id', context.shopId)
      .order('name')

    if (error) {
      console.error('Search error:', error)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.noItemsFound()
    }

    return templates.searchResults(
      items.map((i) => ({ name: i.name, status: i.status })),
      shopName
    )
  } catch (err) {
    console.error('Search handler error:', err)
    return templates.error()
  }
}
