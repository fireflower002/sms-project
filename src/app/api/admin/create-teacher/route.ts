import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // 1. Check server configuration
    if (!supabaseUrl) {
      console.error('[API create-teacher] Missing NEXT_PUBLIC_SUPABASE_URL')
      return NextResponse.json({ error: 'Server configuration error: NEXT_PUBLIC_SUPABASE_URL is missing.' }, { status: 500 })
    }

    if (!serviceRoleKey) {
      console.error('[API create-teacher] Missing SUPABASE_SERVICE_ROLE_KEY in environment')
      return NextResponse.json({
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
      return NextResponse.json({ error: 'Unauthorized: No active admin session found. Please sign in again.' }, { status: 401 })
    }

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (adminProfile?.role !== 'admin') {
      console.warn('[API create-teacher] Forbidden attempt by user:', callerUser.id, 'role:', adminProfile?.role)
      return NextResponse.json({ error: 'Forbidden: Admin privileges required to create teachers.' }, { status: 403 })
    }

    // 3. Parse payload
    const body = await request.json()
    const { full_name, email, tempPassword, subjects } = body

    if (!full_name || !email || !tempPassword) {
      return NextResponse.json({ error: 'Missing required fields (full_name, email, tempPassword)' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName  = full_name.trim()

    // 4. Create Supabase Auth user server-side with email pre-confirmed
    const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: normalizedName },
    })

    if (createAuthError) {
      console.error('[API create-teacher] Auth createUser error:', createAuthError)
      return NextResponse.json({ error: createAuthError.message || 'Failed to create user in Auth system.' }, { status: 400 })
    }

    const userId = authData.user.id

    // 5. Upsert into allowed_users (is_registered = true since Auth user is created)
    const allowedPayload: any = {
      email: normalizedEmail,
      full_name: normalizedName,
      subjects: subjects || [],
      is_registered: true,
      must_change_password: true,
    }
    const { error: allowedErr } = await adminSupabase.from('allowed_users').upsert(allowedPayload, { onConflict: 'email' })
    if (allowedErr) console.warn('[API create-teacher] allowed_users upsert warning:', allowedErr.message)

    // 6. Ensure profile is created with must_change_password = true
    const profilePayload: any = {
      id: userId,
      email: normalizedEmail,
      full_name: normalizedName,
      role: 'teacher',
      subjects: subjects || [],
      must_change_password: true,
    }
    const { error: profileErr } = await adminSupabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
    if (profileErr) console.warn('[API create-teacher] profiles upsert warning:', profileErr.message)

    return NextResponse.json({ success: true, email: normalizedEmail, userId })
  } catch (err: any) {
    console.error('[API create-teacher] Unexpected server error:', err)
    return NextResponse.json({ error: err?.message || 'Server error creating teacher' }, { status: 500 })
  }
}
