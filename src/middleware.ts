import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// In-memory sliding window rate limiter for /item/ scan route
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>()

function isRateLimited(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  if (!record || now > record.expiresAt) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs })
    return false
  }
  if (record.count >= limit) {
    return true
  }
  record.count++
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle public item QR scan route with rate limiting
  if (pathname.startsWith('/item')) {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'anonymous'
    if (isRateLimited(clientIp)) {
      return new NextResponse('Too Many Requests. Please try again later.', { status: 429 })
    }
    return NextResponse.next()
  }

  // Public routes — no auth required
  const publicRoutes = [
    '/',
    '/admin/login',
    '/teacher/login',
    '/reset-password',
  ]
  if (publicRoutes.some(r => pathname === r || pathname.startsWith('/api/auth'))) {
    return NextResponse.next()
  }

  // Build a response we can attach cookies to
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to appropriate login page
  if (!user) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    if (pathname.startsWith('/teacher')) {
      return NextResponse.redirect(new URL('/teacher/login', request.url))
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in — check role & password change requirement for protected sections
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const mustChangePassword = profile?.must_change_password ?? false

  // Force password change redirect for teachers
  if (role === 'teacher' && mustChangePassword && pathname !== '/teacher/profile') {
    return NextResponse.redirect(new URL('/teacher/profile?changePassword=true', request.url))
  }

  // Admin trying to access teacher routes → redirect to admin
  if (pathname.startsWith('/teacher') && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Teacher trying to access admin routes → redirect to teacher
  if (pathname.startsWith('/admin') && role === 'teacher') {
    return NextResponse.redirect(new URL('/teacher', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
