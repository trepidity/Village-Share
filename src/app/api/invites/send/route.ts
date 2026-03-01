import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteEmail } from "@/lib/email/send-invite";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shopId, email, role } = await request.json();

  if (!shopId || !email || !role) {
    return NextResponse.json(
      { error: "shopId, email, and role are required" },
      { status: 400 }
    );
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the current user is an owner or admin of this shop
  const { data: membership } = await admin
    .from("shop_members")
    .select("role")
    .eq("shop_id", shopId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch shop details
  const { data: shop } = await admin
    .from("shops")
    .select("name, description")
    .eq("id", shopId)
    .single();

  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  // Fetch inviter display name
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const inviterName = profile?.display_name || "A VillageShare member";

  // Create the invite
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: insertError } = await admin.from("shop_invites").insert({
    shop_id: shopId,
    invited_by: user.id,
    email,
    token,
    role,
    expires_at: expiresAt.toISOString(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Build the invite URL
  const origin =
    request.headers.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const inviteUrl = `${origin}/invite/${token}`;

  // Send the email
  try {
    await sendInviteEmail({
      to: email,
      inviterName,
      shopName: shop.name,
      shopDescription: shop.description,
      role,
      inviteUrl,
    });
  } catch (err) {
    // Invite was created but email failed — report the error
    return NextResponse.json(
      {
        error: `Invite created but email failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
