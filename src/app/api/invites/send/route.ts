import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { sendSms } from "@/lib/twilio/send-sms";
import { inviteSms } from "@/lib/sms/invite-template";
import { normalizePhone } from "@/lib/utils/phone";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { villageId, email, phone, role } = await request.json();

  if (!villageId || !role) {
    return NextResponse.json(
      { error: "villageId and role are required" },
      { status: 400 }
    );
  }

  if (!email && !phone) {
    return NextResponse.json(
      { error: "Either email or phone is required" },
      { status: 400 }
    );
  }

  if (email && phone) {
    return NextResponse.json(
      { error: "Provide either email or phone, not both" },
      { status: 400 }
    );
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the current user is an owner or admin of this village
  const { data: membership } = await admin
    .from("village_members")
    .select("role")
    .eq("village_id", villageId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch village details
  const { data: village } = await admin
    .from("villages")
    .select("name, description")
    .eq("id", villageId)
    .single();

  if (!village) {
    return NextResponse.json({ error: "Village not found" }, { status: 404 });
  }

  // Fetch inviter display name
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const inviterName = profile?.display_name || "A VillageShare member";

  // Create the invite (token-only, no phone/email stored on the invite)
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: insertError } = await admin.from("village_invites").insert({
    village_id: villageId,
    invited_by: user.id,
    token,
    role,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Build the invite URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/${token}`;

  if (phone) {
    // Send SMS invite (delivery mechanism only)
    const normalizedPhone = normalizePhone(phone);
    try {
      await sendSms(
        normalizedPhone,
        inviteSms({ inviterName, villageName: village.name, role, inviteUrl })
      );
    } catch (err) {
      return NextResponse.json(
        {
          error: `Invite created but SMS failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  } else {
    // Send email invite (delivery mechanism only)
    try {
      await sendInviteEmail({
        to: email,
        inviterName,
        villageName: village.name,
        villageDescription: village.description,
        role,
        inviteUrl,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: `Invite created but email failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
