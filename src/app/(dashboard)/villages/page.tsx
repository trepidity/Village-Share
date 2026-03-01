import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Home, Users, Store } from "lucide-react"

export default async function VillagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: memberships } = await supabase
    .from("village_members")
    .select("role, villages(id, name, description)")
    .eq("user_id", user.id)

  const villages = memberships
    ?.map((m) => {
      const village = m.villages as unknown as { id: string; name: string; description: string | null }
      return { ...village, role: m.role }
    })
    .filter(Boolean) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Villages</h1>
          <p className="text-muted-foreground">Your community groups</p>
        </div>
        <Button asChild>
          <Link href="/villages/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Village
          </Link>
        </Button>
      </div>

      {villages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No villages yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Create your first village or ask someone to invite you.
            </p>
            <Button asChild>
              <Link href="/villages/new">Create Your First Village</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {villages.map((village) => (
            <Link key={village.id} href={`/villages/${village.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{village.name}</CardTitle>
                    <Badge variant={village.role === "owner" ? "default" : "secondary"}>
                      {village.role}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {village.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      Members
                    </span>
                    <span className="flex items-center gap-1">
                      <Store className="size-3.5" />
                      Shops
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
