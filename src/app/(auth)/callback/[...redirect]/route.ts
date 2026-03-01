import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildRedirectResponse } from "../route";

/**
 * Catch-all callback route: /callback/invite/[token] etc.
 *
 * The redirect path is encoded in the URL path itself (not query params),
 * because Supabase strips query params from the OAuth redirectTo URL.
 * The path segments after /callback/ become the redirect destination.
 *
 * Example: OAuth redirectTo = /callback/invite/abc123
 *   → Supabase redirects to /callback/invite/abc123?code=...
 *   → This handler extracts /invite/abc123 and redirects there after auth
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ redirect: string[] }> }
) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const { redirect } = await params;
  const next = `/${redirect.join("/")}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return await buildRedirectResponse(origin, next, supabase);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
