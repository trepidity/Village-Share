import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Plus,
  Settings,
  Store,
  Users,
  UserPlus,
} from "lucide-react";

export default async function VillageDetailPage({
  params,
}: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = await params;
  const supabase = await createClient();

  const { data: village, error } = await supabase
    .from("villages")
    .select("*")
    .eq("id", villageId)
    .single();

  if (error || !village) {
    notFound();
  }

  const [{ data: shops }, { count: memberCount }, { data: currentMembership }] =
    await Promise.all([
      supabase
        .from("shops")
        .select("id, name, short_name, description, is_active, owner_id, profiles:owner_id(display_name)")
        .eq("village_id", villageId)
        .order("created_at", { ascending: false }),
      supabase
        .from("village_members")
        .select("*", { count: "exact", head: true })
        .eq("village_id", villageId),
      supabase
        .from("village_members")
        .select("role")
        .eq("village_id", villageId)
        .single(),
    ]);

  const villageShops = shops ?? [];
  const isAdminOrOwner =
    currentMembership?.role === "owner" || currentMembership?.role === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/villages">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{village.name}</h1>
          {village.description && (
            <p className="text-muted-foreground">{village.description}</p>
          )}
        </div>
        {isAdminOrOwner && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/villages/${villageId}/settings`}>
              <Settings className="size-4" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Store className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{villageShops.length}</p>
              <p className="text-sm text-muted-foreground">Collections</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Users className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{memberCount ?? 0}</p>
              <p className="text-sm text-muted-foreground">Members</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Members</h2>
        <Button variant="outline" asChild>
          <Link href={`/villages/${villageId}/members`}>
            <UserPlus className="size-4" />
            Manage Members
          </Link>
        </Button>
      </div>

      {/* Shops section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Collections</h2>
        <Button asChild>
          <Link href={`/collections/new?villageId=${villageId}`}>
            <Plus className="size-4" />
            Add Collection
          </Link>
        </Button>
      </div>

      {villageShops.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Store className="mb-4 size-12 text-muted-foreground" />
            <CardTitle className="mb-2">No collections yet</CardTitle>
            <CardDescription>
              Create the first collection in this village to start sharing items.
            </CardDescription>
            <Button className="mt-4" asChild>
              <Link href={`/collections/new?villageId=${villageId}`}>
                <Plus className="size-4" />
                Create First Collection
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {villageShops.map((shop) => {
            const owner = shop.profiles as unknown as { display_name: string | null } | null;
            return (
              <Link key={shop.id} href={`/collections/${shop.id}`}>
                <Card className="hover:border-primary/50 transition-colors h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{shop.name}</CardTitle>
                      {!shop.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {shop.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {owner?.display_name && (
                      <p className="text-xs text-muted-foreground">
                        Owned by {owner.display_name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
