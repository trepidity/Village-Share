"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database, VillageRole } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  Mail,
  Phone,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

type VillageMember = Database["public"]["Tables"]["village_members"]["Row"] & {
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

type VillageInvite = Database["public"]["Tables"]["village_invites"]["Row"];

const roleConfig: Record<VillageRole, { label: string; icon: React.ReactNode; className: string }> = {
  owner: {
    label: "Owner",
    icon: <Crown className="size-3" />,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="size-3" />,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  member: {
    label: "Member",
    icon: <User className="size-3" />,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
};

export default function VillageMembersPage({
  params,
}: {
  params: Promise<{ villageId: string }>;
}) {
  const { villageId } = use(params);
  const supabase = createClient();

  const [members, setMembers] = useState<VillageMember[]>([]);
  const [invites, setInvites] = useState<VillageInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<VillageRole | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<VillageRole>("member");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [sendingPhone, setSendingPhone] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [{ data: membersData }, { data: invitesData }] = await Promise.all([
      supabase
        .from("village_members")
        .select("*, profiles(display_name, avatar_url)")
        .eq("village_id", villageId)
        .order("created_at"),
      supabase
        .from("village_invites")
        .select("*")
        .eq("village_id", villageId)
        .is("accepted_at", null)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);

    const typedMembers = (membersData ?? []) as unknown as VillageMember[];
    setMembers(typedMembers);
    setInvites(invitesData ?? []);

    if (user) {
      const currentMember = typedMembers.find((m) => m.user_id === user.id);
      if (currentMember) setCurrentUserRole(currentMember.role);
    }

    setLoading(false);
  }, [villageId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isOwnerOrAdmin =
    currentUserRole === "owner" || currentUserRole === "admin";

  const createInvite = async () => {
    setCreating(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: insertError } = await supabase
        .from("village_invites")
        .insert({
          village_id: villageId,
          invited_by: user.id,
          token,
          role: inviteRole,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) throw new Error(insertError.message);

      setInviteOpen(false);
      setInviteRole("member");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const sendEmailInvite = async () => {
    setSendingEmail(true);
    setError("");
    setEmailSent(false);

    try {
      const res = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villageId, email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");

      setEmailSent(true);
      setInviteEmail("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSendingEmail(false);
    }
  };

  const sendSmsInvite = async () => {
    setSendingPhone(true);
    setError("");
    setSmsSent(false);

    try {
      const res = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villageId, phone: invitePhone, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send SMS invite");

      setSmsSent(true);
      setInvitePhone("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send SMS invite");
    } finally {
      setSendingPhone(false);
    }
  };

  const copyInviteLink = async (token: string, inviteId: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateMemberRole = async (memberId: string, newRole: VillageRole) => {
    const { error: updateError } = await supabase
      .from("village_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await fetchData();
  };

  const removeMember = async (memberId: string, memberRole: VillageRole) => {
    if (memberRole === "owner") {
      setError("Cannot remove the village owner.");
      return;
    }
    if (!confirm("Are you sure you want to remove this member?")) return;

    const { error: deleteError } = await supabase
      .from("village_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await fetchData();
  };

  const revokeInvite = async (inviteId: string) => {
    const { error: deleteError } = await supabase
      .from("village_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await fetchData();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/villages/${villageId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold">Village Members</h1>

        {isOwnerOrAdmin && (
          <Dialog open={inviteOpen} onOpenChange={(open) => {
              setInviteOpen(open);
              if (!open) {
                setError("");
                setEmailSent(false);
                setInviteEmail("");
                setSmsSent(false);
                setInvitePhone("");
              }
            }}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="size-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite to Village</DialogTitle>
                <DialogDescription>
                  Send an invite via email or SMS, or generate a link to share.
                  Anyone who clicks the link and signs in will be added.
                  Invites expire in 7 days.
                </DialogDescription>
              </DialogHeader>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {emailSent && (
                <p className="text-sm text-green-600">
                  Invite email sent successfully!
                </p>
              )}
              {smsSent && (
                <p className="text-sm text-green-600">
                  SMS invite sent successfully!
                </p>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as VillageRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Tabs defaultValue="email" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="email" className="flex-1">
                    <Mail className="mr-1 size-3.5" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="flex-1">
                    <Phone className="mr-1 size-3.5" />
                    SMS
                  </TabsTrigger>
                  <TabsTrigger value="link" className="flex-1">
                    <Link2 className="mr-1 size-3.5" />
                    Link
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="email" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email address</label>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={sendEmailInvite}
                    disabled={sendingEmail || !inviteEmail}
                    className="w-full"
                  >
                    {sendingEmail && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    <Mail className="size-4" />
                    Send Email Invite
                  </Button>
                </TabsContent>
                <TabsContent value="sms" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone number</label>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={sendSmsInvite}
                    disabled={sendingPhone || !invitePhone}
                    className="w-full"
                  >
                    {sendingPhone && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    <Phone className="size-4" />
                    Send SMS Invite
                  </Button>
                </TabsContent>
                <TabsContent value="link">
                  <Button
                    onClick={createInvite}
                    disabled={creating}
                    className="w-full"
                  >
                    {creating && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    <Link2 className="size-4" />
                    Generate Invite Link
                  </Button>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && !inviteOpen && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle>Current Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <Avatar>
                <AvatarFallback>
                  {getInitials(member.profiles?.display_name ?? null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {member.profiles?.display_name || "Unknown User"}
                  {member.user_id === currentUserId && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                <Badge className={`${roleConfig[member.role].className} gap-1`}>
                  {roleConfig[member.role].icon}
                  {roleConfig[member.role].label}
                </Badge>
              </div>

              {isOwnerOrAdmin &&
                member.user_id !== currentUserId &&
                member.role !== "owner" && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        updateMemberRole(member.id, v as VillageRole)
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeMember(member.id, member.role)}
                    >
                      <User className="size-3 text-destructive" />
                    </Button>
                  </div>
                )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {isOwnerOrAdmin && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites ({invites.length})</CardTitle>
            <CardDescription>
              Share these links to invite people to your village.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Link2 className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`${roleConfig[invite.role].className} gap-1`}
                    >
                      {roleConfig[invite.role].icon}
                      {roleConfig[invite.role].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground font-mono">
                    /invite/{invite.token.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyInviteLink(invite.token, invite.id)}
                  >
                    {copiedId === invite.id ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    {copiedId === invite.id ? "Copied" : "Copy Link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeInvite(invite.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
