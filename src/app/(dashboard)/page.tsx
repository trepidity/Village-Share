import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Plus, Store, ArrowRight, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch user's shops via shop_members join
  const { data: memberships } = await supabase
    .from("shop_members")
    .select(
      `
      role,
      shops (
        id,
        name,
        description,
        is_active
      )
    `
    )
    .eq("user_id", user.id)

  // Build shop list with counts
  const shopIds = (memberships ?? [])
    .map((m) => (m.shops as unknown as { id: string })?.id)
    .filter(Boolean)

  // Fetch item counts per shop
  let itemCounts: Record<string, number> = {}
  if (shopIds.length > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("shop_id")
      .in("shop_id", shopIds)

    if (items) {
      for (const item of items) {
        itemCounts[item.shop_id] = (itemCounts[item.shop_id] || 0) + 1
      }
    }
  }

  // Fetch member counts per shop
  let memberCounts: Record<string, number> = {}
  if (shopIds.length > 0) {
    const { data: members } = await supabase
      .from("shop_members")
      .select("shop_id")
      .in("shop_id", shopIds)

    if (members) {
      for (const member of members) {
        memberCounts[member.shop_id] = (memberCounts[member.shop_id] || 0) + 1
      }
    }
  }

  // Fetch recent borrows for the user
  const { data: recentBorrows } = await supabase
    .from("borrows")
    .select(
      `
      id,
      status,
      due_at,
      borrowed_at,
      created_at,
      items (
        name
      ),
      shops:from_shop_id (
        name
      )
    `
    )
    .eq("borrower_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  const shops = (memberships ?? []).map((m) => {
    const shop = m.shops as unknown as {
      id: string
      name: string
      description: string | null
      is_active: boolean
    }
    return {
      ...shop,
      role: m.role,
      itemCount: itemCounts[shop?.id] || 0,
      memberCount: memberCounts[shop?.id] || 0,
    }
  }).filter((s) => s.id)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here is an overview of your shops and activity.
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/shops/new">
                <Plus className="h-4 w-4" />
                Create New Shop
              </Link>
            </Button>
            {shops.length > 0 && (
              <Button variant="outline" asChild>
                <Link href="/shops">
                  <Store className="h-4 w-4" />
                  View All Shops
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Your Shops */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Shops</h2>
          {shops.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/shops">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        {shops.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No shops yet</CardTitle>
              <CardDescription className="mb-4">
                Create your first lending library to start sharing items with
                your community.
              </CardDescription>
              <Button asChild>
                <Link href="/shops/new">
                  <Plus className="h-4 w-4" />
                  Create Your First Shop
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <Link key={shop.id} href={`/shops/${shop.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{shop.name}</CardTitle>
                      <Badge
                        variant={shop.role === "owner" ? "default" : "secondary"}
                      >
                        {shop.role}
                      </Badge>
                    </div>
                    {shop.description && (
                      <CardDescription className="line-clamp-2">
                        {shop.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {shop.itemCount} {shop.itemCount === 1 ? "item" : "items"}
                      </span>
                      <span>
                        {shop.memberCount}{" "}
                        {shop.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>

        {!recentBorrows || recentBorrows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">No activity yet</CardTitle>
              <CardDescription>
                Your recent borrows and returns will appear here.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y">
              {recentBorrows.map((borrow) => {
                const item = borrow.items as unknown as { name: string } | null
                const shop = borrow.shops as unknown as { name: string } | null
                return (
                  <div
                    key={borrow.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item?.name ?? "Unknown item"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        from {shop?.name ?? "Unknown shop"}
                        {borrow.due_at && (
                          <> &middot; due {new Date(borrow.due_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={
                        borrow.status === "active"
                          ? "default"
                          : borrow.status === "returned"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {borrow.status}
                    </Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
