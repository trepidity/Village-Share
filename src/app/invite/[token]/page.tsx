import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptVillageInvite } from "@/lib/invites/accept";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, UserPlus } from "lucide-react";
import { InviteSignIn } from "@/components/invite-sign-in";

async function acceptInvite(formData: FormData) {
  "use server";

  const token = formData.get("token") as string;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await acceptVillageInvite(token, user.id);

  if (!result.success) {
    redirect("/chat");
  }

  redirect("/chat");
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Look up the village by invite token (admin client — page is accessible to unauthenticated users)
  const { data: village } = await admin
    .from("villages")
    .select("id, name, description")
    .eq("invite_token", token)
    .single();

  if (!village) {
    notFound();
  }

  // Auto-accept: if user is authenticated, accept immediately and redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const result = await acceptVillageInvite(token, user.id);
    if (result.success) {
      redirect("/chat");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <UserPlus className="size-6 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join a village.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Home className="size-5 text-muted-foreground" />
              <p className="text-lg font-semibold">{village.name}</p>
            </div>
            {village.description && (
              <p className="text-sm text-muted-foreground">
                {village.description}
              </p>
            )}
          </div>

          {user ? (
            <form action={acceptInvite}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full" size="lg">
                <UserPlus className="size-4" />
                Accept Invite & Join Village
              </Button>
            </form>
          ) : (
            <InviteSignIn token={token} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
