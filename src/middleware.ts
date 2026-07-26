import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// In-memory sliding window rate limiter
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>()

function isRateLimited(key: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now()
  if (rateLimitMap.size > 2000) {
    rateLimitMap.forEach((v, k) => {
      if (now > v.expiresAt) rateLimitMap.delete(k)
    })
  }

  const record = rateLimitMap.get(key)
  if (!record || now > record.expiresAt) {
    rateLimitMap.set(key, { count: 1, expiresAt: now + windowMs })
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
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anonymous'

  // Handle public item QR scan route with rate limiting (60 req/min)
  if (pathname.startsWith('/item')) {
    if (isRateLimited(`item:${clientIp}`, 60, 60000)) {
      return new NextResponse('Too Many Requests. Please try again later.', { status: 429 })
    }
    return NextResponse.next()
  }

  // Handle API route rate limiting for sensitive & admin endpoints
  if (pathname.startsWith('/api')) {
    if (pathname.startsWith('/api/admin')) {
      // Sensitive admin-privileged operations (create teacher, reset password, etc.): 20 req/min
      if (isRateLimited(`api-admin:${clientIp}`, 20, 60000)) {
        return NextResponse.json({ error: 'Too many requests on admin endpoint. Please wait a minute.' }, { status: 429 })
      }
    } else if (pathname.startsWith('/api/auth')) {
      // Authentication API endpoints: 15 req/min
      if (isRateLimited(`api-auth:${clientIp}`, 15, 60000)) {
        return NextResponse.json({ error: 'Too many auth requests. Please try again later.' }, { status: 429 })
      }
      return NextResponse.next()
    } else {
      // General API routes (chat, teacher endpoints): 40 req/min
      if (isRateLimited(`api-gen:${clientIp}`, 40, 60000)) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
      }
    }
  }

  // Public pages — no auth required
  const publicRoutes = [
    '/',
    '/admin/login',
    '/teacher/login',
    '/reset-password',
  ]
  if (publicRoutes.some(r => pathname === r)) {
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
  let role: string | undefined = undefined
  let mustChangePassword = false

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr) {
    const { data: fallbackProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    role = fallbackProfile?.role
  } else {
    role = profile?.role
    mustChangePassword = profile?.must_change_password ?? false
  }

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|map|ico)$).*)',
  ],
}
