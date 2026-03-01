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

  console.log(`[MW] pathname=${pathname} user=${user?.id ?? 'NONE'} auth_redirect_cookie=${request.cookies.get('auth_redirect')?.value ?? 'NONE'}`)

  // Allow public routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/callback') ||
    pathname.startsWith('/invite/')
  ) {
    console.log(`[MW] -> allowing public route: ${pathname}`)
    return supabaseResponse
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    console.log(`[MW] -> no user, redirecting to: ${url.toString()}`)
    return NextResponse.redirect(url)
  }

  // Allow setup-phone page
  if (pathname.startsWith('/setup-phone')) {
    console.log(`[MW] -> allowing setup-phone`)
    return supabaseResponse
  }

  // Check if phone is set up - redirect to phone setup if not
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_verified')
    .eq('id', user.id)
    .single()

  console.log(`[MW] phone_verified=${profile?.phone_verified} isInvitePath=${pathname.startsWith('/invite/')}`)

  if (profile && !profile.phone_verified && !pathname.startsWith('/invite/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/setup-phone'
    console.log(`[MW] -> phone not verified, redirecting to setup-phone`)
    return NextResponse.redirect(url)
  }

  // Allow invite paths and village creation through without village membership
  if (pathname.startsWith('/invite/') || pathname.startsWith('/villages/new')) {
    console.log(`[MW] -> allowing invite/new village path: ${pathname}`)
    return supabaseResponse
  }

  // Check if user belongs to at least one village - redirect to onboarding if not
  const { count } = await supabase
    .from('village_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  console.log(`[MW] village_count=${count}`)

  if (count === 0) {
    const url = request.nextUrl.clone()
    url.pathname = '/villages/new'
    console.log(`[MW] -> no villages, redirecting to /villages/new`)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
