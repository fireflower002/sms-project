import { type NextRequest, NextResponse } from 'next/server'

/**
 * ARCHITECTURAL NOTICE (PRE-LAUNCH BLOCKER FOR MULTI-REGION PRODUCTION):
 * The sliding window rate limiter below uses an in-memory JS Map (`rateLimitMap`).
 * In a multi-instance or serverless deployment (e.g., Vercel / Next.js Lambdas),
 * memory state is NOT shared across region instances or lambda invocations.
 *
 * TODO (Production Pre-Launch Requirement):
 * Replace this in-memory Map with a distributed store such as Upstash Redis (`@upstash/ratelimit` & `@upstash/redis`):
 * 1. Provision Upstash Redis database and set `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` in env.
 * 2. Instantiate `Ratelimit` sliding window: `const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(60, '1 m') })`.
 * 3. Invoke `await ratelimit.limit(identifier)` inside `middleware`.
 */
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

interface JWTPayload {
  sub: string
  email?: string
  exp?: number
  role?: string
  app_metadata?: { role?: string; must_change_password?: boolean }
  user_metadata?: { role?: string; must_change_password?: boolean }
}

function parseJwtPayload(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Cryptographically verify HS256 JWT signature using Web Crypto API (crypto.subtle)
 * AND validate token expiration (exp claim).
 */
async function verifyHs256Jwt(token: string, secret: string): Promise<{ valid: boolean; payload: JWTPayload | null }> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return { valid: false, payload: null }

    const [headerB64, payloadB64, signatureB64] = parts

    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const signatureBin = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'))
    const signatureBytes = new Uint8Array(signatureBin.length)
    for (let i = 0; i < signatureBin.length; i++) {
      signatureBytes[i] = signatureBin.charCodeAt(i)
    }

    const dataBytes = encoder.encode(`${headerB64}.${payloadB64}`)
    const isSignatureValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      dataBytes
    )

    if (!isSignatureValid) return { valid: false, payload: null }

    const payload = parseJwtPayload(token)
    if (!payload) return { valid: false, payload: null }

    // Enforce token expiration (exp claim) check
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return { valid: false, payload: null }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, payload: null }
  }
}

function getSupabaseAccessToken(request: NextRequest): { accessToken: string | null; refreshToken: string | null } {
  const allCookies = request.cookies.getAll()
  
  const authTokenCookies = allCookies
    .filter(c => c.name.includes('-auth-token'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  let tokenStr = ''
  if (authTokenCookies.length > 0) {
    tokenStr = authTokenCookies.map(c => c.value).join('')
  } else {
    const directAccess = request.cookies.get('sb-access-token')?.value
    if (directAccess) return { accessToken: directAccess, refreshToken: null }
  }

  if (!tokenStr) return { accessToken: null, refreshToken: null }

  try {
    let unescaped = tokenStr
    if (unescaped.startsWith('base64-')) {
      unescaped = atob(unescaped.slice(7))
    }
    const parsed = JSON.parse(unescaped)
    if (Array.isArray(parsed)) {
      return { accessToken: parsed[0] || null, refreshToken: parsed[1] || null }
    }
    if (parsed && typeof parsed === 'object') {
      return { accessToken: parsed.access_token || null, refreshToken: parsed.refresh_token || null }
    }
  } catch {
    if (tokenStr.includes('.')) {
      return { accessToken: tokenStr, refreshToken: null }
    }
  }
  return { accessToken: null, refreshToken: null }
}

async function verifyUserWithSupabase(accessToken: string, supabaseUrl: string, anonKey: string) {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey,
      },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function fetchProfileRoleFromDb(userId: string, email: string, supabaseUrl: string, anonKey: string, accessToken: string) {
  try {
    const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${anonKey}`
    const [profRes, allowRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=role,must_change_password`, {
        headers: { 'apikey': anonKey, 'Authorization': authHeader },
      }),
      fetch(`${supabaseUrl}/rest/v1/allowed_users?email=eq.${encodeURIComponent(email)}&select=role,must_change_password`, {
        headers: { 'apikey': anonKey, 'Authorization': authHeader },
      }),
    ])

    const profiles = profRes.ok ? await profRes.json() : []
    const allowed = allowRes.ok ? await allowRes.json() : []

    const profile = profiles[0]
    const allow = allowed[0]

    return {
      role: profile?.role || allow?.role || 'teacher',
      mustChangePassword: Boolean(profile?.must_change_password || allow?.must_change_password),
    }
  } catch {
    return { role: 'teacher', mustChangePassword: false }
  }
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
      if (isRateLimited(`api-admin:${clientIp}`, 20, 60000)) {
        return NextResponse.json({ error: 'Too many requests on admin endpoint. Please wait a minute.' }, { status: 429 })
      }
    } else if (pathname.startsWith('/api/auth')) {
      if (isRateLimited(`api-auth:${clientIp}`, 15, 60000)) {
        return NextResponse.json({ error: 'Too many auth requests. Please try again later.' }, { status: 429 })
      }
      return NextResponse.next()
    } else {
      if (isRateLimited(`api-gen:${clientIp}`, 40, 60000)) {
        return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
      }
    }
  }

  // Public pages & PWA assets — no auth required
  const publicRoutes = [
    '/',
    '/admin/login',
    '/teacher/login',
    '/reset-password',
    '/offline',
    '/sw.js',
    '/manifest.webmanifest',
  ]
  if (
    publicRoutes.some(r => pathname === r) ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/swe-worker-')
  ) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || ''

  const { accessToken } = getSupabaseAccessToken(request)

  if (!accessToken) {
    if (pathname.startsWith('/admin')) return NextResponse.redirect(new URL('/admin/login', request.url))
    if (pathname.startsWith('/teacher')) return NextResponse.redirect(new URL('/teacher/login', request.url))
    return NextResponse.redirect(new URL('/', request.url))
  }

  let userPayload: JWTPayload | null = null
  let isSignatureVerified = false

  // 1. If SUPABASE_JWT_SECRET is configured, perform local cryptographic HMAC-SHA256 verification AND exp check
  if (jwtSecret) {
    const res = await verifyHs256Jwt(accessToken, jwtSecret)
    if (res.valid && res.payload) {
      isSignatureVerified = true
      userPayload = res.payload
    }
  }

  // 2. If local secret is not provided or signature check failed, perform authoritative server verification via Supabase Auth API
  if (!isSignatureVerified) {
    const verifiedUser = await verifyUserWithSupabase(accessToken, supabaseUrl, anonKey)
    if (verifiedUser && verifiedUser.id) {
      isSignatureVerified = true
      userPayload = {
        sub: verifiedUser.id,
        email: verifiedUser.email,
        app_metadata: verifiedUser.app_metadata,
        user_metadata: verifiedUser.user_metadata,
      }
    }
  }

  // Cryptographic verification failed or token expired → redirect to login
  if (!isSignatureVerified || !userPayload || !userPayload.sub) {
    if (pathname.startsWith('/admin')) return NextResponse.redirect(new URL('/admin/login', request.url))
    if (pathname.startsWith('/teacher')) return NextResponse.redirect(new URL('/teacher/login', request.url))
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Check expiration (double safety assertion)
  if (userPayload.exp && userPayload.exp * 1000 < Date.now()) {
    if (pathname.startsWith('/admin')) return NextResponse.redirect(new URL('/admin/login', request.url))
    if (pathname.startsWith('/teacher')) return NextResponse.redirect(new URL('/teacher/login', request.url))
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in — read role & database password change requirement
  let role = userPayload.app_metadata?.role || userPayload.user_metadata?.role || userPayload.role
  const dbProfile = await fetchProfileRoleFromDb(userPayload.sub, userPayload.email || '', supabaseUrl, anonKey, accessToken)

  if (!role) role = dbProfile.role
  const mustChangePassword = dbProfile.mustChangePassword

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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|swe-worker-.*|manifest\\.webmanifest|offline|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff|woff2|ttf|map|ico)$).*)',
  ],
}
