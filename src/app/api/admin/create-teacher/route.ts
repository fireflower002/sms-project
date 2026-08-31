import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const createTeacherSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name cannot exceed 100 characters'),
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
  phone: z.string().trim().optional(),
  tempPassword: z.string().min(6, 'Temporary password must be at least 6 characters'),
  subjects: z.array(z.string().trim()).optional().default([]),
})

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // 1. Check server configuration
    if (!supabaseUrl) {
      console.error('[API create-teacher] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ success: false, error: 'Server configuration error: NEXT_PUBLIC_SUPABASE_URL is missing.' }, { status: 500 })
    }

    if (!serviceRoleKey) {
      console.error('[API create-teacher] Missing SUPABASE_SERVICE_ROLE_KEY in environment')
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing in environment (.env.local). Please set SUPABASE_SERVICE_ROLE_KEY to enable admin user creation.'
      }, { status: 500 })
    }

    // 2. Verify caller is an authenticated Admin
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let callerUser = null
    try {
      const serverSupabase = await createServerClient()
      const { data: userData } = await serverSupabase.auth.getUser()
      callerUser = userData?.user
    } catch (e) {
      // Server session check failed, try bearer token fallback
    }

    if (!callerUser) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        if (token && token !== 'undefined' && token !== 'null') {
          try {
            const { data: tokenUserData } = await adminSupabase.auth.getUser(token)
            if (tokenUserData?.user) callerUser = tokenUserData.user
          } catch (e) {
            // Ignore bearer token format/signature errors
          }
        }
      }
    }

    if (!callerUser) {
      console.warn('[API create-teacher] Unauthorized attempt: No active session or valid token')
      return NextResponse.json({ success: false, error: 'Unauthorized: No active admin session found. Please sign in again.' }, { status: 401 })
    }

    // Rate Limit Check: max 5 requests per 1 minute per caller user ID / IP
    const rateLimit = checkRateLimit(callerUser.id || getClientIp(request), '/api/admin/create-teacher', {
      windowMs: 60 * 1000,
      maxRequests: 5,
    })
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetInMs)
    }

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (adminProfile?.role !== 'admin') {
      console.warn('[API create-teacher] Forbidden attempt by user:', callerUser.id, 'role:', adminProfile?.role)
      return NextResponse.json({ success: false, error: 'Forbidden: Admin privileges required to create teachers.' }, { status: 403 })
    }

    // 3. Parse & validate payload with Zod schema
    const body = await request.json().catch(() => ({}))
    const parseResult = createTeacherSchema.safeParse(body)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid teacher creation payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { full_name: normalizedName, email: normalizedEmail, phone: rawPhone, tempPassword, subjects } = parseResult.data
    const normalizedPhone = rawPhone?.trim() || null

    // 4. Pre-upsert into allowed_users so handle_new_user trigger can populate default profile fields
    const allowedPayload: any = {
      email: normalizedEmail,
      full_name: normalizedName,
      subjects: subjects || [],
      is_registered: true,
      must_change_password: true,
    }
    const { error: allowedErr } = await adminSupabase.from('allowed_users').upsert(allowedPayload, { onConflict: 'email' })
    if (allowedErr) console.warn('[API create-teacher] allowed_users upsert warning:', allowedErr.message)

    // 5. Create Supabase Auth user server-side with email pre-confirmed and app_metadata claims
    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: 'teacher', must_change_password: true },
      user_metadata: { full_name: normalizedName, must_change_password: true, role: 'teacher' },
    })

    if (createAuthError) {
      console.error('[API create-teacher] Auth createUser error:', createAuthError)
      return NextResponse.json({ success: false, error: createAuthError.message || 'Failed to create user in Auth system.' }, { status: 400 })
    }

    const userId = authData.user.id

    // 6. Ensure profile is updated with phone and must_change_password = true
    const profilePayload: any = {
      id: userId,
      email: normalizedEmail,
      full_name: normalizedName,
      role: 'teacher',
      subjects: subjects || [],
      phone: normalizedPhone,
      must_change_password: true,
    }
    const { error: profileErr } = await adminSupabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
    if (profileErr) console.warn('[API create-teacher] profiles upsert warning:', profileErr.message)

    return NextResponse.json({ success: true, data: { email: normalizedEmail, userId } })
  } catch (err: unknown) {
    console.error('[API create-teacher] Unexpected server error:', err)
    const message = err instanceof Error ? err.message : 'Server error creating teacher'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
