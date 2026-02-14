import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwilioClient } from "@/lib/twilio/client";
import { normalizePhone } from "@/lib/utils/phone";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { phone, action, code } = body;

  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);
  const twilioClient = getTwilioClient();

  if (action === "verify") {
    try {
      await twilioClient.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({
          to: normalizedPhone,
          channel: "sms",
        });

      return NextResponse.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send verification";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (action === "check") {
    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    try {
      const check = await twilioClient.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({
          to: normalizedPhone,
          code,
        });

      if (check.status === "approved") {
        // Create SMS session for this phone/user combo
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();

        await admin.from("sms_sessions").upsert({
          phone: normalizedPhone,
          user_id: user.id,
        }, { onConflict: "phone" });

        return NextResponse.json({ success: true, phone: normalizedPhone });
      }

      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
