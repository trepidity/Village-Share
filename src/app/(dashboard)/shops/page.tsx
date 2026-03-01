import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Store } from "lucide-react"

export default async function ShopsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // RLS ensures only shops in user's villages are returned
  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, description, is_active, owner_id, village_id, villages(name)")
    .order("created_at", { ascending: false })

  const shopList = (shops ?? []).map((shop) => ({
    ...shop,
    isOwner: shop.owner_id === user.id,
    villageName: (shop.villages as unknown as { name: string } | null)?.name ?? null,
  }))

  // Group by village
  const grouped = shopList.reduce<Record<string, typeof shopList>>((acc, shop) => {
    const key = shop.villageName ?? "Unknown Village"
    if (!acc[key]) acc[key] = []
    acc[key].push(shop)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Shops</h1>
          <p className="text-muted-foreground">All shops across your villages</p>
        </div>
        <Button asChild>
          <Link href="/shops/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Shop
          </Link>
        </Button>
      </div>

      {shopList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shops yet</h3>
            <p className="text-muted-foreground mb-4">Create your first shop to start sharing items</p>
            <Button asChild>
              <Link href="/shops/new">Create Your First Shop</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([villageName, villageShops]) => (
          <div key={villageName} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {villageName}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {villageShops.map((shop) => (
                <Link key={shop.id} href={`/shops/${shop.id}`}>
                  <Card className="hover:border-primary/50 transition-colors h-full">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{shop.name}</CardTitle>
                        {shop.isOwner && (
                          <Badge variant="default">owner</Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {shop.description || "No description"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!shop.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
