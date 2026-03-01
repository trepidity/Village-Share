import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return await buildRedirectResponse(origin, "/", supabase);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

async function buildRedirectResponse(
  origin: string,
  next: string,
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_verified")
      .eq("id", user.id)
      .single();

    if (!profile?.phone_verified) {
      const setupUrl = next !== "/"
        ? `${origin}/setup-phone?redirect=${encodeURIComponent(next)}`
        : `${origin}/setup-phone`;
      return NextResponse.redirect(setupUrl);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

export { buildRedirectResponse };
