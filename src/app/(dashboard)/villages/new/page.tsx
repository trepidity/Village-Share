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
import { Home, ArrowLeft, Link2 } from "lucide-react";
import Link from "next/link";

const createVillageSchema = z.object({
  name: z.string().min(1, "Village name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type CreateVillageForm = z.infer<typeof createVillageSchema>;

export default function NewVillagePage() {
  const [error, setError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<CreateVillageForm>({
    resolver: zodResolver(createVillageSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (values: CreateVillageForm) => {
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to create a village.");
      return;
    }

    const { data: village, error: insertError } = await supabase
      .from("villages")
      .insert({
        name: values.name,
        description: values.description || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push(`/villages/${village.id}`);
  };

  const handleJoinByToken = () => {
    if (!inviteToken.trim()) return;
    // Extract token from URL if full URL was pasted
    const match = inviteToken.match(/\/invite\/([a-f0-9-]+)/);
    const token = match ? match[1] : inviteToken.trim();
    router.push(`/invite/${token}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/villages">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Get Started</h1>
      </div>

      {/* Join via invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            Have an Invite?
          </CardTitle>
          <CardDescription>
            Paste the invite link or token you received to join an existing village.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Paste invite link or token..."
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
            />
            <Button onClick={handleJoinByToken} disabled={!inviteToken.trim()}>
              Join
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Create new village */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="size-5" />
            Create a New Village
          </CardTitle>
          <CardDescription>
            A village is a community group where members share items across
            shops. Create one and invite your neighbors.
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
                    <FormLabel>Village Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Elm Street Village" {...field} />
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
                        placeholder="A place where our neighborhood shares tools, kitchen gear, and more..."
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
                  <Link href="/villages">Cancel</Link>
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Creating..." : "Create Village"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
