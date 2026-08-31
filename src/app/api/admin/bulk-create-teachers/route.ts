import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/rateLimit'

const teacherItemSchema = z.object({
  full_name: z.string().trim().min(2, 'Teacher full name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Invalid teacher email address'),
  phone: z.string().trim().optional().nullable(),
  subjects: z.array(z.string().trim()).optional().default([]),
})

const bulkCreateTeachersSchema = z.object({
  teachers: z.array(teacherItemSchema).min(1, 'At least one teacher record is required'),
})

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Server configuration error: Missing Supabase credentials.' }, { status: 500 })
    }

    // Verify caller is an authenticated Admin
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
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session required.' }, { status: 401 })
    }

    // Rate Limit Check: max 3 requests per 5 minutes per caller user ID / IP
    const rateLimit = checkRateLimit(callerUser.id || getClientIp(request), '/api/admin/bulk-create-teachers', {
      windowMs: 5 * 60 * 1000,
      maxRequests: 3,
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
      return NextResponse.json({ success: false, error: 'Forbidden: Admin privileges required.' }, { status: 403 })
    }

    // Validate payload with Zod schema
    const body = await request.json().catch(() => ({}))
    const parseResult = bulkCreateTeachersSchema.safeParse(body)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid bulk teacher creation payload'
      return NextResponse.json({ success: false, error: firstError }, { status: 400 })
    }

    const { teachers } = parseResult.data

    const results = []

    for (const t of teachers) {
      const email = t.email
      const fullName = t.full_name
      // Generate a temporary password e.g. Teacher! + random 4-digit number
      const randomDigits = randomInt(1000, 10000)
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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Error creating user'
        results.push({ email, full_name: fullName, status: 'failed', error: errMsg })
      }
    }

    return NextResponse.json({ success: true, data: { results } })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
