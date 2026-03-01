import { createAdminClient } from '@/lib/supabase/admin'

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

  const nameLower = shopName.toLowerCase()

  // Try matching by shop name or short_name
  const byShopName = shops.filter(
    (shop) =>
      shop.name.toLowerCase().includes(nameLower) ||
      shop.short_name.toLowerCase().includes(nameLower)
  )

  if (byShopName.length === 1) return byShopName[0].id

  // Try matching by owner display_name
  const ownerIds = [...new Set(shops.map((s) => s.owner_id))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ownerIds)
    .ilike('display_name', `%${shopName}%`)

  if (profiles && profiles.length === 1) {
    const matchingOwner = profiles[0]
    const match = shops.find((s) => s.owner_id === matchingOwner.id)
    if (match) return match.id
  }

  return null
}
