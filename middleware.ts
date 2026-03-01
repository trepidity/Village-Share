import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/callback')
  ) {
    return supabaseResponse
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Allow setup-phone page
  if (pathname.startsWith('/setup-phone')) {
    return supabaseResponse
  }

  // Check if phone is set up - redirect to phone setup if not
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_verified')
    .eq('id', user.id)
    .single()

  if (profile && !profile.phone_verified && !pathname.startsWith('/invite/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/setup-phone'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
