import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error: Missing Supabase credentials.' }, { status: 500 })
    }

    // Verify caller is an authenticated Admin
    const authHeader = request.headers.get('Authorization')
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let callerUser = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: userData } = await adminSupabase.auth.getUser(token)
      if (userData?.user) callerUser = userData.user
    }

    if (!callerUser) {
      const serverSupabase = await createServerClient()
      const { data: userData } = await serverSupabase.auth.getUser()
      callerUser = userData?.user
    }

    if (!callerUser) {
      return NextResponse.json({ error: 'Unauthorized: Admin session required.' }, { status: 401 })
    }

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required.' }, { status: 403 })
    }

    const body = await request.json()
    const { teachers } = body // Array of { full_name, email, phone, subjects }

    if (!Array.isArray(teachers) || teachers.length === 0) {
      return NextResponse.json({ error: 'No teachers provided' }, { status: 400 })
    }

    const results = []

    for (const t of teachers) {
      const email = t.email.trim().toLowerCase()
      const fullName = t.full_name.trim()
      // Generate a temporary password e.g. Pass!2026 + random 4-digit number
      const randomDigits = Math.floor(1000 + Math.random() * 9000)
      const tempPassword = `Teacher!${randomDigits}`

      try {
        // 1. Create Auth User
        const { data: authData, error: createError } = await adminSupabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })

        if (createError) {
          results.push({ email, full_name: fullName, status: 'failed', error: createError.message })
          continue
        }

        const userId = authData.user.id

        // 2. Upsert into allowed_users (is_registered = true since Auth user is created)
        await adminSupabase.from('allowed_users').upsert({
          email,
          full_name: fullName,
          subjects: t.subjects || [],
          is_registered: true,
          must_change_password: true,
        }, { onConflict: 'email' })

        // 3. Upsert into profiles with must_change_password = true
        await adminSupabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: fullName,
          role: 'teacher',
          subjects: t.subjects || [],
          phone: t.phone || null,
          must_change_password: true,
        }, { onConflict: 'id' })

        results.push({
          userId,
          email,
          full_name: fullName,
          tempPassword,
          status: 'success'
        })
      } catch (err: any) {
        results.push({ email, full_name: fullName, status: 'failed', error: err?.message || 'Error creating user' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
