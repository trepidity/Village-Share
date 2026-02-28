import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Try to resolve a shop by name or owner display name.
 * Searches only among shops the user is a member of.
 * Returns the shopId if exactly one match is found, null otherwise.
 */
export async function resolveShopByName(
  userId: string,
  shopName: string
): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: memberships, error } = await supabase
    .from('shop_members')
    .select('shop_id, shops!inner(id, name, short_name, owner_id)')
    .eq('user_id', userId)

  if (error || !memberships || memberships.length === 0) return null

  const nameLower = shopName.toLowerCase()

  // Try matching by shop name or short_name
  const byShopName = memberships.filter((m) => {
    const shop = m.shops as unknown as { id: string; name: string; short_name: string; owner_id: string }
    return shop.name.toLowerCase().includes(nameLower) ||
      shop.short_name.toLowerCase().includes(nameLower)
  })

  if (byShopName.length === 1) return byShopName[0].shop_id

  // Try matching by owner display_name
  const ownerIds = [
    ...new Set(
      memberships.map((m) => {
        const shop = m.shops as unknown as { id: string; name: string; short_name: string; owner_id: string }
        return shop.owner_id
      })
    ),
  ]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', ownerIds)
    .ilike('display_name', `%${shopName}%`)

  if (profiles && profiles.length === 1) {
    const matchingOwner = profiles[0]
    const match = memberships.find((m) => {
      const shop = m.shops as unknown as { id: string; name: string; short_name: string; owner_id: string }
      return shop.owner_id === matchingOwner.id
    })
    if (match) return match.shop_id
  }

  return null
}
