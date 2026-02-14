"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Store, ArrowLeft } from "lucide-react";
import Link from "next/link";

const createShopSchema = z.object({
  name: z.string().min(1, "Shop name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type CreateShopForm = z.infer<typeof createShopSchema>;

export default function NewShopPage() {
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<CreateShopForm>({
    resolver: zodResolver(createShopSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

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
        description: values.description || null,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Also add the owner as a shop member
    await supabase.from("shop_members").insert({
      shop_id: shop.id,
      user_id: user.id,
      role: "owner",
    });

    router.push(`/shops/${shop.id}`);
  };

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
            A shop is a community space where members can share and borrow
            items. Give it a name and optional description.
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shop Name</FormLabel>
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
