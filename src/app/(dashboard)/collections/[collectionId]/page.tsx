import { notFound } from "next/navigation";
import Image from "next/image";
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
import {
  Package,
  Users,
  Settings,
  Plus,
  ArrowLeft,
  ImageIcon,
  Pencil,
} from "lucide-react";
import type { ItemStatus } from "@/lib/supabase/types";
import { CollectionIcon } from "@/components/collection-icon";

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

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId: shopId } = await params;
  const supabase = await createClient();

  const { data: shop, error } = await supabase
    .from("shops")
    .select("*")
    .eq("id", shopId)
    .single();

  if (error || !shop) {
    notFound();
  }

  const [{ data: items }, { data: villageData }] = await Promise.all([
    supabase
      .from("items")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false }),
    supabase
      .from("villages")
      .select("id, name")
      .eq("id", shop.village_id)
      .single(),
  ]);

  const village = villageData;

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
          <div className="flex items-center gap-2">
            <CollectionIcon type={shop.type} className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{shop.name}</h1>
          </div>
          {village && (
            <Link
              href={`/villages/${village.id}`}
              className="text-sm text-primary hover:underline"
            >
              {village.name}
            </Link>
          )}
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
        <Link href={village ? `/villages/${village.id}/members` : "#"}>
          <Card className="hover:border-primary/50 transition-colors">
            <CardContent className="flex items-center gap-3 pt-0">
              <Users className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Village Members</p>
              </div>
            </CardContent>
          </Card>
        </Link>
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
            <h2 className="text-lg font-semibold">Items</h2>
            <Button asChild>
              <Link href={`/collections/${shopId}/items?add=true`}>
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
                  <Link href={`/collections/${shopId}/items?add=true`}>
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
                      <Image
                        src={item.photo_url}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-cover"
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
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        {item.category && (
                          <Badge variant="outline" className="mt-1 w-fit">
                            {item.category}
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon-xs" asChild>
                        <Link href={`/collections/${shopId}/items?edit=${item.id}`}>
                          <Pencil className="size-3" />
                        </Link>
                      </Button>
                    </div>
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
            {village && (
              <Button asChild>
                <Link href={`/villages/${village.id}/members`}>
                  <Users className="size-4" />
                  Manage Village Members
                </Link>
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="mb-4 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                Members are managed at the village level. Anyone in the village
                can access this collection.
              </p>
              {village && (
                <Button variant="outline" className="mt-4" asChild>
                  <Link href={`/villages/${village.id}/members`}>
                    View Village Members
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Collection Settings</h2>
            <Button asChild>
              <Link href={`/collections/${shopId}/settings`}>
                <Settings className="size-4" />
                Edit Settings
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="space-y-4 pt-0">
              <div>
                <p className="text-sm font-medium">Collection Name</p>
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
