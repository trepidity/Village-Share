"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { Database, ItemStatus } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Item = Database["public"]["Tables"]["items"]["Row"];

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

const itemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

export default function ItemsPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlParamsHandled = useRef(false);

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: "", description: "", category: "" },
  });

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [shopId, supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle ?add=true and ?edit={id} URL params once after items load
  useEffect(() => {
    if (urlParamsHandled.current) return;
    const addParam = searchParams.get("add");
    const editParam = searchParams.get("edit");

    if (addParam === "true") {
      setAddOpen(true);
      urlParamsHandled.current = true;
      router.replace(`/shops/${shopId}/items`, { scroll: false });
    } else if (editParam && items.length > 0) {
      const item = items.find((i) => i.id === editParam);
      if (item) {
        setEditItem(item);
        form.reset({
          name: item.name,
          description: item.description ?? "",
          category: item.category ?? "",
        });
        setPhotoPreview(item.photo_url);
        setPhotoFile(null);
      }
      urlParamsHandled.current = true;
      router.replace(`/shops/${shopId}/items`, { scroll: false });
    }
  }, [searchParams, items, shopId, router, form]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return null;

    const ext = photoFile.name.split(".").pop();
    const filePath = `${shopId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(filePath, photoFile);

    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("item-photos").getPublicUrl(filePath);

    return publicUrl;
  };

  const resetFormState = () => {
    form.reset({ name: "", description: "", category: "" });
    setPhotoFile(null);
    setPhotoPreview(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onAddSubmit = async (values: ItemFormValues) => {
    setError("");
    setUploading(true);

    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      const { error: insertError } = await supabase.from("items").insert({
        shop_id: shopId,
        location_shop_id: shopId,
        name: values.name,
        description: values.description || null,
        category: values.category || null,
        photo_url: photoUrl,
      });

      if (insertError) throw new Error(insertError.message);

      setAddOpen(false);
      resetFormState();
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const onEditSubmit = async (values: ItemFormValues) => {
    if (!editItem) return;
    setError("");
    setUploading(true);

    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

      const updateData: Database["public"]["Tables"]["items"]["Update"] = {
        name: values.name,
        description: values.description || null,
        category: values.category || null,
      };
      if (photoUrl) updateData.photo_url = photoUrl;

      const { error: updateError } = await supabase
        .from("items")
        .update(updateData)
        .eq("id", editItem.id);

      if (updateError) throw new Error(updateError.message);

      setEditItem(null);
      resetFormState();
      await fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await fetchItems();
  };

  const openEditDialog = (item: Item) => {
    setEditItem(item);
    form.reset({
      name: item.name,
      description: item.description ?? "",
      category: item.category ?? "",
    });
    setPhotoPreview(item.photo_url);
    setPhotoFile(null);
    setError("");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/shops/${shopId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold">Manage Items</h1>

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetFormState();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>
                Add an item to your shop for community members to borrow.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Cordless Drill" {...field} />
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
                        <Textarea placeholder="Brief description of the item..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="Tools, Kitchen, Garden..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Photo</label>
                  <div className="flex items-center gap-4">
                    {photoPreview ? (
                      <div className="relative size-20 overflow-hidden rounded-md border">
                        <Image src={photoPreview} alt="Preview" fill unoptimized className="object-cover" />
                      </div>
                    ) : (
                      <div className="flex size-20 items-center justify-center rounded-md border bg-muted">
                        <ImageIcon className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="size-4" />
                        {photoPreview ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={uploading}>
                    {uploading && <Loader2 className="size-4 animate-spin" />}
                    Add Item
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={!!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setEditItem(null);
            resetFormState();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Update the details for this item.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Cordless Drill" {...field} />
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
                      <Textarea placeholder="Brief description of the item..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Tools, Kitchen, Garden..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Photo</label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <div className="relative size-20 overflow-hidden rounded-md border">
                      <Image src={photoPreview} alt="Preview" fill unoptimized className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex size-20 items-center justify-center rounded-md border bg-muted">
                      <ImageIcon className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="size-4" />
                      {photoPreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={uploading}>
                  {uploading && <Loader2 className="size-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="mb-4 size-12 text-muted-foreground" />
            <CardTitle className="mb-2">No items yet</CardTitle>
            <p className="text-muted-foreground">
              Click &quot;Add Item&quot; to add your first item to this shop.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
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
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    {item.category && (
                      <Badge variant="outline" className="mt-1 w-fit">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
