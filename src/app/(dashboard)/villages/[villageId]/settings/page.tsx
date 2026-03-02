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
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";

type Village = Database["public"]["Tables"]["villages"]["Row"];

const villageSchema = z.object({
  name: z.string().min(1, "Village name is required").max(100),
  description: z.string().max(500).optional(),
});

type VillageFormValues = z.infer<typeof villageSchema>;

export default function VillageSettingsPage({
  params,
}: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [village, setVillage] = useState<Village | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const form = useForm<VillageFormValues>({
    resolver: zodResolver(villageSchema),
    defaultValues: { name: "", description: "" },
    values: village
      ? {
          name: village.name,
          description: village.description ?? "",
        }
      : undefined,
  });

  const fetchData = async () => {
    const { data } = await supabase
      .from("villages")
      .select("*")
      .eq("id", villageId)
      .single();

    if (data) setVillage(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId]);

  const onSubmit = async (values: VillageFormValues) => {
    setError("");
    setSuccess("");
    setSaving(true);

    const { error: updateError } = await supabase
      .from("villages")
      .update({
        name: values.name,
        description: values.description || null,
      })
      .eq("id", villageId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess("Village settings saved.");
      await fetchData();
    }

    setSaving(false);
  };

  const deleteVillage = async () => {
    if (deleteConfirm !== village?.name) return;
    setDeleting(true);
    setError("");

    const { error: deleteError } = await supabase
      .from("villages")
      .delete()
      .eq("id", villageId);

    if (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
      return;
    }

    router.push("/villages");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!village) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Village not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/villages/${villageId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Village Settings</h1>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Village Details</CardTitle>
          <CardDescription>
            Update your village name and description.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Village Name</FormLabel>
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

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this village and all its collections, items, and data.
            This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="size-4" />
                Delete Village
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Village</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{village.name}</strong>{" "}
                  and all associated collections, items, members, and data.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <strong>{village.name}</strong> to confirm
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={village.name}
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
                  onClick={deleteVillage}
                  disabled={deleteConfirm !== village.name || deleting}
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
