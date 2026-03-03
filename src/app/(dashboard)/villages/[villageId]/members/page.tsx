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
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Loader2,
  RefreshCw,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

type VillageMember = Database["public"]["Tables"]["village_members"]["Row"] & {
  profiles: { display_name: string | null; avatar_url: string | null } | null;
};

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
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<VillageRole | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [{ data: membersData }, { data: village }] = await Promise.all([
      supabase
        .from("village_members")
        .select("*, profiles(display_name, avatar_url)")
        .eq("village_id", villageId)
        .order("created_at"),
      supabase
        .from("villages")
        .select("invite_token")
        .eq("id", villageId)
        .single(),
    ]);

    const typedMembers = (membersData ?? []) as unknown as VillageMember[];
    setMembers(typedMembers);
    setInviteToken(village?.invite_token ?? null);

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

  const inviteLink = inviteToken
    ? `${window.location.origin}/invite/${inviteToken}`
    : null;

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const regenerateLink = async () => {
    if (!confirm("Generate a new invite link? The current link will stop working.")) return;
    setRegenerating(true);
    setError("");

    try {
      const res = await fetch("/api/invites/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villageId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to regenerate link");

      setInviteToken(data.token);
      setLinkCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate link");
    } finally {
      setRegenerating(false);
    }
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
                setLinkCopied(false);
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
                  Share this link with anyone you want to invite. They&apos;ll join as a member when they sign in.
                </DialogDescription>
              </DialogHeader>

              {error && inviteOpen && <p className="text-sm text-destructive">{error}</p>}

              {inviteLink && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 min-w-0">
                    <p className="flex-1 text-sm font-mono truncate min-w-0">
                      /invite/{inviteToken?.slice(0, 8)}...
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={copyInviteLink}
                    >
                      {linkCopied ? (
                        <Check className="size-4 text-green-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                  {linkCopied && (
                    <p className="text-xs text-muted-foreground">
                      Copied to clipboard!
                    </p>
                  )}
                  <Button
                    variant="outline"
                    onClick={regenerateLink}
                    disabled={regenerating}
                    className="w-full"
                  >
                    {regenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Generate New Link
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Generating a new link will invalidate the current one.
                  </p>
                </div>
              )}
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
    </div>
  );
}
