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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Home, UserPlus } from "lucide-react";
import { InviteSignIn } from "@/components/invite-sign-in";
import type { VillageRole } from "@/lib/supabase/types";

const roleLabels: Record<VillageRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

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

  // Look up the invite using admin client (page is accessible to unauthenticated users)
  const { data: invite, error: inviteError } = await admin
    .from("village_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (!invite) {
    notFound();
  }

  // Check if expired
  const isExpired = new Date(invite.expires_at) < new Date();
  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <Clock className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Invite Expired</CardTitle>
            <CardDescription>
              This invite link has expired. Please ask for a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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

  // Use admin client to bypass RLS — unauthenticated users need to see village details
  const [{ data: village }, { data: inviter }] = await Promise.all([
    admin
      .from("villages")
      .select("id, name, description")
      .eq("id", invite.village_id)
      .single(),
    admin
      .from("profiles")
      .select("display_name")
      .eq("id", invite.invited_by)
      .single(),
  ]);

  if (!village) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Village Not Found</CardTitle>
            <CardDescription>
              The village associated with this invite no longer exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href="/">Go Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
            {inviter?.display_name
              ? `${inviter.display_name} has invited you to join a village.`
              : "You've been invited to join a village."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Home className="size-5 text-muted-foreground" />
              <p className="text-lg font-semibold">{village.name}</p>
            </div>
            {village.description && (
              <p className="mb-3 text-sm text-muted-foreground">
                {village.description}
              </p>
            )}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">
                Role:
              </span>
              <Badge variant="secondary">
                {roleLabels[invite.role]}
              </Badge>
            </div>
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

          <p className="text-center text-xs text-muted-foreground">
            This invite expires on{" "}
            {new Date(invite.expires_at).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
