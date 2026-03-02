"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Calendar,
  Home,
  Loader2,
  Power,
  PowerOff,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";

type Shop = Database["public"]["Tables"]["shops"]["Row"];
type Village = { id: string; name: string };
type BlackoutPeriod = Database["public"]["Tables"]["blackout_periods"]["Row"];

const shopSchema = z.object({
  short_name: z.string().min(1, "Short name is required").max(12, "Short name must be 12 characters or less"),
  name: z.string().min(1, "Collection name is required").max(100),
  description: z.string().max(500).optional(),
});

type ShopFormValues = z.infer<typeof shopSchema>;

const blackoutSchema = z.object({
  starts_at: z.string().min(1, "Start date is required"),
  ends_at: z.string().min(1, "End date is required"),
  reason: z.string().max(200).optional(),
});

type BlackoutFormValues = z.infer<typeof blackoutSchema>;

export default function SettingsPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  const { collectionId: shopId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [shop, setShop] = useState<Shop | null>(null);
  const [village, setVillage] = useState<Village | null>(null);
  const [blackouts, setBlackouts] = useState<BlackoutPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [blackoutOpen, setBlackoutOpen] = useState(false);
  const [addingBlackout, setAddingBlackout] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const form = useForm<ShopFormValues>({
    resolver: zodResolver(shopSchema),
    defaultValues: { short_name: "", name: "", description: "" },
    values: shop
      ? {
          short_name: shop.short_name,
          name: shop.name,
          description: shop.description ?? "",
        }
      : undefined,
  });

  const blackoutForm = useForm<BlackoutFormValues>({
    resolver: zodResolver(blackoutSchema),
    defaultValues: { starts_at: "", ends_at: "", reason: "" },
  });

  const fetchData = async () => {
    const [{ data: shopData }, { data: blackoutData }] = await Promise.all([
      supabase.from("shops").select("*").eq("id", shopId).single(),
      supabase
        .from("blackout_periods")
        .select("*")
        .eq("shop_id", shopId)
        .is("item_id", null)
        .order("starts_at", { ascending: true }),
    ]);

    if (shopData) {
      setShop(shopData);
      // Fetch village info
      const { data: villageData } = await supabase
        .from("villages")
        .select("id, name")
        .eq("id", shopData.village_id)
        .single();
      if (villageData) setVillage(villageData);
    }

    setBlackouts(blackoutData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const onSubmit = async (values: ShopFormValues) => {
    setError("");
    setSuccess("");
    setSaving(true);

    const { error: updateError } = await supabase
      .from("shops")
      .update({
        short_name: values.short_name,
        name: values.name,
        description: values.description || null,
      })
      .eq("id", shopId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Collection settings saved.");
      await fetchData();
    }

    setSaving(false);
  };

  const toggleActive = async () => {
    if (!shop) return;
    setToggling(true);
    setError("");

    const { error: updateError } = await supabase
      .from("shops")
      .update({ is_active: !shop.is_active })
      .eq("id", shopId);

    if (updateError) {
      setError(updateError.message);
    } else {
      await fetchData();
    }

    setToggling(false);
  };

  const deleteShop = async () => {
    if (deleteConfirm !== shop?.name) return;
    setDeleting(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("shops")
      .delete()
      .eq("id", shopId);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.push("/");
  };

  const addBlackout = async (values: BlackoutFormValues) => {
    setError("");
    setAddingBlackout(true);

    const { error: insertError } = await supabase
      .from("blackout_periods")
      .insert({
        shop_id: shopId,
        starts_at: new Date(values.starts_at).toISOString(),
        ends_at: new Date(values.ends_at).toISOString(),
        reason: values.reason || null,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setBlackoutOpen(false);
      blackoutForm.reset({ starts_at: "", ends_at: "", reason: "" });
      await fetchData();
    }

    setAddingBlackout(false);
  };

  const removeBlackout = async (blackoutId: string) => {
    const { error: deleteError } = await supabase
      .from("blackout_periods")
      .delete()
      .eq("id", blackoutId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Collection not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/collections/${shopId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Collection Settings</h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      {/* Village info */}
      {village && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-0">
            <Home className="size-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Village</p>
              <p className="text-muted-foreground">{village.name}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/villages/${village.id}`}>View Village</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit shop details */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Details</CardTitle>
          <CardDescription>
            Update your collection name and description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input maxLength={12} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  <Save className="size-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Active toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Status</CardTitle>
          <CardDescription>
            Deactivating a collection hides it from new borrowing requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {shop.is_active ? (
                <Power className="size-5 text-green-600" />
              ) : (
                <PowerOff className="size-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {shop.is_active ? "Active" : "Inactive"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {shop.is_active
                    ? "Members can browse and borrow items."
                    : "This collection is currently hidden from members."}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={toggleActive}
              disabled={toggling}
            >
              {toggling && <Loader2 className="size-4 animate-spin" />}
              {shop.is_active ? "Deactivate" : "Activate"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blackout periods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Blackout Periods</CardTitle>
              <CardDescription>
                Periods when the collection is unavailable for borrowing.
              </CardDescription>
            </div>
            <Dialog open={blackoutOpen} onOpenChange={setBlackoutOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="size-4" />
                  Add Period
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Blackout Period</DialogTitle>
                  <DialogDescription>
                    Set a period when the collection will be unavailable.
                  </DialogDescription>
                </DialogHeader>
                <Form {...blackoutForm}>
                  <form
                    onSubmit={blackoutForm.handleSubmit(addBlackout)}
                    className="space-y-4"
                  >
                    <FormField
                      control={blackoutForm.control}
                      name="starts_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={blackoutForm.control}
                      name="ends_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={blackoutForm.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Holiday closure, maintenance..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={addingBlackout}>
                        {addingBlackout && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Add Period
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {blackouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No blackout periods scheduled.
            </p>
          ) : (
            <div className="space-y-2">
              {blackouts.map((blackout) => {
                const now = new Date();
                const start = new Date(blackout.starts_at);
                const end = new Date(blackout.ends_at);
                const isActive = now >= start && now <= end;
                const isPast = now > end;

                return (
                  <div
                    key={blackout.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {start.toLocaleDateString()} &mdash;{" "}
                          {end.toLocaleDateString()}
                        </p>
                        {isActive && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Active
                          </Badge>
                        )}
                        {isPast && (
                          <Badge variant="secondary">Past</Badge>
                        )}
                      </div>
                      {blackout.reason && (
                        <p className="text-sm text-muted-foreground">
                          {blackout.reason}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeBlackout(blackout.id)}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this collection and all its data. This action cannot be
            undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="size-4" />
                Delete Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Collection</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{shop.name}</strong> and
                  all associated items, members, and data. This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <strong>{shop.name}</strong> to confirm
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={shop.name}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={deleteShop}
                  disabled={deleteConfirm !== shop.name || deleting}
                >
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  Delete Forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
