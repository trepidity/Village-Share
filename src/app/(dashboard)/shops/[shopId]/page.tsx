import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Package,
  Users,
  Settings,
  Plus,
  ArrowLeft,
  ImageIcon,
} from "lucide-react";
import type { ItemStatus } from "@/lib/supabase/types";

const statusConfig: Record<
  ItemStatus,
  { label: string; className: string }
> = {
  available: {
    label: "Available",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  borrowed: {
    label: "Borrowed",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  unavailable: {
    label: "Unavailable",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const supabase = await createClient();

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();

  if (error || !shop) {
    notFound();
  }

  const [{ data: items }, { count: memberCount }] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("shop_members")
      .select("*", { count: "exact", head: true })
      .eq("shop_id", shopId),
  ]);

  const shopItems = items ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          {shop.description && (
            <p className="text-muted-foreground">{shop.description}</p>
          )}
        </div>
        {!shop.is_active && (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Package className="size-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{shopItems.length}</p>
              <p className="text-sm text-muted-foreground">Items</p>
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
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex items-center gap-3 pt-0">
            <div className="size-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {shopItems.filter((i) => i.status === "available").length}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {shopItems.length > 0
                  ? Math.round(
                      (shopItems.filter((i) => i.status === "available").length /
                        shopItems.length) *
                        100
                    )
                  : 0}
                %
              </p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="gap-1.5">
            <Package className="size-4" />
            Items
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="size-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Items tab */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shop Items</h2>
            <Button asChild>
              <Link href={`/shops/${shopId}/items`}>
                <Plus className="size-4" />
                Add Item
              </Link>
            </Button>
          </div>

          {shopItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="mb-4 size-12 text-muted-foreground" />
                <CardTitle className="mb-2">No items yet</CardTitle>
                <CardDescription>
                  Add your first item to start sharing with your community.
                </CardDescription>
                <Button className="mt-4" asChild>
                  <Link href={`/shops/${shopId}/items`}>
                    <Plus className="size-4" />
                    Add Your First Item
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shopItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <div className="relative aspect-square bg-muted">
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <ImageIcon className="size-12 text-muted-foreground" />
                      </div>
                    )}
                    <Badge
                      className={`absolute right-2 top-2 ${statusConfig[item.status].className}`}
                    >
                      {statusConfig[item.status].label}
                    </Badge>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    {item.category && (
                      <Badge variant="outline" className="w-fit">
                        {item.category}
                      </Badge>
                    )}
                  </CardHeader>
                  {item.description && (
                    <CardContent className="pt-0">
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Members</h2>
            <Button asChild>
              <Link href={`/shops/${shopId}/members`}>
                <Users className="size-4" />
                Manage Members
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-4 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {memberCount ?? 0} member{(memberCount ?? 0) !== 1 ? "s" : ""} in
                this shop.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href={`/shops/${shopId}/members`}>
                  View & Manage Members
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Shop Settings</h2>
            <Button asChild>
              <Link href={`/shops/${shopId}/settings`}>
                <Settings className="size-4" />
                Edit Settings
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-0">
              <div>
                <p className="text-sm font-medium">Shop Name</p>
                <p className="text-muted-foreground">{shop.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Description</p>
                <p className="text-muted-foreground">
                  {shop.description || "No description set"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant={shop.is_active ? "default" : "secondary"}>
                  {shop.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-muted-foreground">
                  {new Date(shop.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
