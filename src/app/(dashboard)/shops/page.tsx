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

  // Get user's shops via shop_members
  const { data: memberships } = await supabase
    .from("shop_members")
    .select("role, shops(id, name, description, is_active)")
    .eq("user_id", user.id)

  const shops = memberships
    ?.map((m) => {
      const shop = m.shops as unknown as { id: string; name: string; description: string | null; is_active: boolean }
      return { ...shop, role: m.role }
    })
    .filter(Boolean) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Shops</h1>
          <p className="text-muted-foreground">Manage your lending libraries</p>
        </div>
        <Button asChild>
          <Link href="/shops/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Shop
          </Link>
        </Button>
      </div>

      {shops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shops yet</h3>
            <p className="text-muted-foreground mb-4">Create your first lending library to start sharing items</p>
            <Button asChild>
              <Link href="/shops/new">Create Your First Shop</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <Link key={shop.id} href={`/shops/${shop.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{shop.name}</CardTitle>
                    <Badge variant={shop.role === "owner" ? "default" : "secondary"}>
                      {shop.role}
                    </Badge>
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
      )}
    </div>
  )
}
