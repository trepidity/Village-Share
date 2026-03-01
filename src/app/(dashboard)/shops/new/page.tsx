"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const createShopSchema = z.object({
  village_id: z.string().min(1, "Village is required"),
  short_name: z.string().min(1, "Short name is required").max(12, "Short name must be 12 characters or less"),
  name: z.string().min(1, "Display name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type CreateShopForm = z.infer<typeof createShopSchema>;

type Village = { id: string; name: string };

export default function NewShopPage() {
  const [error, setError] = useState("");
  const [villages, setVillages] = useState<Village[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const preselectedVillageId = searchParams.get("villageId") ?? "";

  const form = useForm<CreateShopForm>({
    resolver: zodResolver(createShopSchema),
    defaultValues: {
      village_id: preselectedVillageId,
      short_name: "",
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    const fetchVillages = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("village_members")
        .select("villages(id, name)")
        .eq("user_id", user.id);

      const villageList = (data ?? [])
        .map((m) => m.villages as unknown as Village)
        .filter(Boolean);

      setVillages(villageList);

      // Auto-select if only one village and no preselection
      if (villageList.length === 1 && !preselectedVillageId) {
        form.setValue("village_id", villageList[0].id);
      }

      setLoadingVillages(false);
    };

    fetchVillages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: CreateShopForm) => {
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to create a shop.");
      return;
    }

    const { data: shop, error: insertError } = await supabase
      .from("shops")
      .insert({
        name: values.name,
        short_name: values.short_name,
        description: values.description || null,
        owner_id: user.id,
        village_id: values.village_id,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/shops/${shop.id}`);
  };

  if (loadingVillages) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (villages.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No villages yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              You need to be in a village before creating a shop.
            </p>
            <Button asChild>
              <Link href="/villages/new">Create a Village First</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create a New Shop</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-5" />
            Shop Details
          </CardTitle>
          <CardDescription>
            A shop is a lending library within your village where members can
            share and borrow items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="village_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Village</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a village" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {villages.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input placeholder="ToolLib" maxLength={12} {...field} />
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
                      <Input placeholder="My Neighborhood Tool Library" {...field} />
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
                      <Textarea
                        placeholder="A place where neighbors share tools, kitchen gear, and more..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create Shop"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
