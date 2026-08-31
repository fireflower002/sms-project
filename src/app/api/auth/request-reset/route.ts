import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const requestResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
})

async function dummyWork() {
  const encoder = new TextEncoder()
  const data = encoder.encode('timing-attack-mitigation-dummy-salt-' + Math.random())
  for (let i = 0; i < 5; i++) {
    await crypto.subtle.digest('SHA-256', data)
  }
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request)
    const rateLimit = checkRateLimit(clientIp, '/api/auth/request-reset', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const body = await request.json().catch(() => ({}))
    const parseResult = requestResetSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid email address'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { email } = parseResult.data

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[API request-reset] Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in server environment.')
      return NextResponse.json({ success: false, error: 'Server configuration error.' }, { status: 500 })
    }

    // Instantiated strictly server-side using SUPABASE_SERVICE_ROLE_KEY (never exposed to client browser bundle)
    const dbClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Look up profile using admin client (bypassing RLS safely server-side)
    const { data: profile } = await dbClient
      .from('profiles')
      .select('role')
      .eq('email', email)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    if (isAdmin) {
      // 2. Dispatch OTP / password reset email for admin
      const serverSupabase = await createServerClient()
      const { error: otpErr } = await serverSupabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })

      if (otpErr) {
        await serverSupabase.auth.resetPasswordForEmail(email)
      }
    } else {
      // Timing attack protection: run dummy computation to equalize execution time
      await dummyWork()
    }

    // Always return generic success response to prevent user enumeration
    return NextResponse.json({
      success: true,
      data: {
        message: 'If an administrator account exists for this email, a verification code has been sent.',
      }
    })
  } catch (err: unknown) {
    console.error('[API request-reset] Error:', err)
    return NextResponse.json({
      success: true,
      data: {
        message: 'If an administrator account exists for this email, a verification code has been sent.',
      }
    })
  }
}
