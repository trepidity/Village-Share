import { createAdminClient } from '@/lib/supabase/admin'

function normalizeShopSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bmy\s+(shop|collection|kitchen|workshop|craft room|library|garage|closet|place)\b/g, 'my')
    .replace(/'s\b/g, '')
    .replace(/\b(shop|collection|kitchen|workshop|craft room|library|garage|closet|place)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Try to resolve a shop by name or owner display name.
 * Searches only among shops in villages the user belongs to.
 * Returns the shopId if exactly one match is found, null otherwise.
 */
export async function resolveShopByName(
  userId: string,
  shopName: string
): Promise<string | null> {
  const supabase = createAdminClient()

  // Get user's village IDs
  const { data: villageMemberships, error: vmError } = await supabase
    .from('village_members')
    .select('village_id')
    .eq('user_id', userId)

  if (vmError || !villageMemberships || villageMemberships.length === 0) return null

  const villageIds = villageMemberships.map((vm) => vm.village_id)

  // Get shops in those villages
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, short_name, owner_id')
    .in('village_id', villageIds)
    .eq('is_active', true)

  if (error || !shops || shops.length === 0) return null

  const normalizedQuery = normalizeShopSearch(shopName)
  const nameLower = shopName.toLowerCase().trim()

  if (normalizedQuery === 'my') {
    const myShops = shops.filter((shop) => shop.owner_id === userId)
    if (myShops.length === 1) return myShops[0].id
    return null
  }

  // Try matching by normalized shop name or short_name first
  const byShopName = shops.filter((shop) => {
    const normalizedName = normalizeShopSearch(shop.name)
    const normalizedShortName = normalizeShopSearch(shop.short_name)

    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedShortName.includes(normalizedQuery) ||
      shop.name.toLowerCase().includes(nameLower) ||
      shop.short_name.toLowerCase().includes(nameLower)
    )
  })

  if (byShopName.length === 1) return byShopName[0].id

  // Try matching by owner display_name
  const ownerIds = [...new Set(shops.map((s) => s.owner_id))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ownerIds)

  const profileMatches =
    profiles?.filter((profile) => {
      const normalizedDisplayName = normalizeShopSearch(profile.display_name ?? '')
      return (
        normalizedDisplayName.includes(normalizedQuery) ||
        profile.display_name?.toLowerCase().includes(nameLower)
      )
    }) ?? []

  if (profileMatches.length === 1) {
    const matchingOwner = profileMatches[0]
    const match = shops.find((s) => s.owner_id === matchingOwner.id)
    if (match) return match.id
  }

  return null
}
