import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, Home, UserPlus } from "lucide-react";
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

  // Fetch the invite
  const { data: invite } = await supabase
    .from("village_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invite) {
    redirect("/");
  }

  // Check if already a member
  const { data: existingMember } = await supabase
    .from("village_members")
    .select("id")
    .eq("village_id", invite.village_id)
    .eq("user_id", user.id)
    .single();

  if (!existingMember) {
    // Create village member record
    await supabase.from("village_members").insert({
      village_id: invite.village_id,
      user_id: user.id,
      role: invite.role,
    });
  }

  // Mark invite as accepted
  await supabase
    .from("village_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  redirect(`/villages/${invite.village_id}`);
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Look up the invite
  const { data: invite } = await supabase
    .from("village_invites")
    .select("*")
    .eq("token", token)
    .single();

  if (!invite) {
    notFound();
  }

  // Check if already accepted
  if (invite.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <CheckCircle className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle>Invite Already Accepted</CardTitle>
            <CardDescription>
              This invite has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <a href={`/villages/${invite.village_id}`}>Go to Village</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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

  // Fetch village details and inviter
  const [{ data: village }, { data: inviter }] = await Promise.all([
    supabase
      .from("villages")
      .select("id, name, description")
      .eq("id", invite.village_id)
      .single(),
    supabase
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

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                You need to sign in before you can accept this invite.
              </p>
              <Button className="w-full" size="lg" asChild>
                <a href={`/login?redirect=/invite/${token}`}>
                  Sign In to Accept
                </a>
              </Button>
            </div>
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
