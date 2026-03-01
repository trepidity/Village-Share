import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = await request.json();

  if (!phone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Update profile with phone and mark as verified
  const { error: profileError } = await admin
    .from("profiles")
    .update({ phone, phone_verified: true })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Create SMS session so user can use SMS commands
  await admin.from("sms_sessions").upsert(
    { phone, user_id: user.id },
    { onConflict: "phone" }
  );

  // Auto-accept any pending invites matching this phone number
  const { data: pendingInvites } = await admin
    .from("shop_invites")
    .select("id, shop_id, role")
    .eq("phone", phone)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  if (pendingInvites && pendingInvites.length > 0) {
    for (const invite of pendingInvites) {
      // Check if already a member of this shop
      const { data: existing } = await admin
        .from("shop_members")
        .select("id")
        .eq("shop_id", invite.shop_id)
        .eq("user_id", user.id)
        .single();

      if (!existing) {
        await admin.from("shop_members").insert({
          shop_id: invite.shop_id,
          user_id: user.id,
          role: invite.role,
        });
      }

      await admin
        .from("shop_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);
    }
  }

  return NextResponse.json({ success: true });
}
