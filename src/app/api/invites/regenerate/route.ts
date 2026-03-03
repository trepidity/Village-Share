import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { villageId } = await request.json();

  if (!villageId) {
    return NextResponse.json(
      { error: "villageId is required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Verify the current user is an admin or owner of this village
  const { data: membership } = await admin
    .from("village_members")
    .select("role")
    .eq("village_id", villageId)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate a new token and update the village
  const newToken = crypto.randomUUID().replaceAll("-", "");

  const { error: updateError } = await admin
    .from("villages")
    .update({ invite_token: newToken })
    .eq("id", villageId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ token: newToken });
}
