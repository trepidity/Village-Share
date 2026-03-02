import { createAdminClient } from '@/lib/supabase/admin'
import { templates } from '@/lib/sms/templates'
import type { ParsedIntent } from '@/lib/sms/intents'

interface SearchContext {
  userId: string
  shopId?: string // optional: if absent, search all collections
}

/**
 * Handle the SEARCH intent.
 * If shopId is provided, search within that shop.
 * If shopId is absent, search across all shops in the user's villages.
 */
export async function handleSearch(
  intent: ParsedIntent,
  context: SearchContext
): Promise<string> {
  try {
    if (context.shopId) {
      return await searchSingleShop(intent, context.userId, context.shopId)
    }
    return await searchCrossShop(intent, context.userId)
  } catch (err) {
    console.error('Search handler error:', err)
    return templates.error()
  }
}

/**
 * Search within a single shop (original behavior).
 */
async function searchSingleShop(
  intent: ParsedIntent,
  userId: string,
  shopId: string
): Promise<string> {
  const supabase = createAdminClient()
  const query = intent.entities.itemName

  const { data: shop } = await supabase
    .from('shops')
    .select('short_name')
    .eq('id', shopId)
    .single()

  const shopName = shop?.short_name ?? 'your shop'

  if (query) {
    let itemQuery = supabase
      .from('items')
      .select('id, name, status')
      .eq('shop_id', shopId)

    const words = query.split(/\s+/).filter(Boolean)
    for (const word of words) {
      itemQuery = itemQuery.ilike('name', `%${word}%`)
    }

    const { data: items, error } = await itemQuery

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

    return templates.disambiguation(
      'item',
      items.map((i) => `${i.name} (${i.status})`)
    )
  }

  // No query - list all items in the shop
  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, status')
    .eq('shop_id', shopId)
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
}

/**
 * Search across all shops in the user's villages.
 * Follows the pattern from availability.ts.
 */
async function searchCrossShop(
  intent: ParsedIntent,
  userId: string
): Promise<string> {
  const supabase = createAdminClient()
  const query = intent.entities.itemName

  // 1. Get user's villages
  const { data: villageMemberships, error: vmError } = await supabase
    .from('village_members')
    .select('village_id')
    .eq('user_id', userId)

  if (vmError || !villageMemberships || villageMemberships.length === 0) {
    return templates.noActiveShop()
  }

  const villageIds = villageMemberships.map((vm) => vm.village_id)

  // 2. Get all active shops in those villages
  const { data: shops, error: shopError } = await supabase
    .from('shops')
    .select('id, short_name')
    .in('village_id', villageIds)
    .eq('is_active', true)

  if (shopError) {
    console.error('Cross-shop search error:', shopError)
    return templates.error()
  }

  if (!shops || shops.length === 0) {
    return templates.noActiveShop()
  }

  // 3. If only 1 shop, delegate to single-shop path
  if (shops.length === 1) {
    return await searchSingleShop(intent, userId, shops[0].id)
  }

  // 4. Build shopMap
  const shopIds = shops.map((s) => s.id)
  const shopMap = new Map(shops.map((s) => [s.id, s.short_name]))

  if (query) {
    // 5. Fuzzy search across all shops
    let itemQuery = supabase
      .from('items')
      .select('id, name, status, shop_id')
      .in('shop_id', shopIds)

    const words = query.split(/\s+/).filter(Boolean)
    for (const word of words) {
      itemQuery = itemQuery.ilike('name', `%${word}%`)
    }

    const { data: items, error } = await itemQuery

    if (error) {
      console.error('Cross-shop search error:', error)
      return templates.error()
    }

    if (!items || items.length === 0) {
      return templates.noItemsFound(query, true)
    }

    // Single result — use simpler single-shop format
    if (items.length === 1) {
      const item = items[0]
      const shopName = shopMap.get(item.shop_id) ?? 'your collection'
      return templates.searchResults(
        [{ name: item.name, status: item.status }],
        shopName
      )
    }

    return templates.searchResultsCrossShop(
      query,
      items.map((i) => ({
        shopName: shopMap.get(i.shop_id) ?? 'Unknown',
        name: i.name,
        status: i.status,
      }))
    )
  }

  // 6. No query — list items across all shops
  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, status, shop_id')
    .in('shop_id', shopIds)
    .order('name')
    .limit(30)

  if (error) {
    console.error('Cross-shop search error:', error)
    return templates.error()
  }

  if (!items || items.length === 0) {
    return templates.noItemsFound(undefined, true)
  }

  return templates.searchResultsCrossShop(
    undefined,
    items.map((i) => ({
      shopName: shopMap.get(i.shop_id) ?? 'Unknown',
      name: i.name,
      status: i.status,
    }))
  )
}
