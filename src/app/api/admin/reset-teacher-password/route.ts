import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const resetPasswordSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format').optional(),
  email: z.string().trim().toLowerCase().email('Invalid email address format').optional(),
}).refine(data => !!data.teacherId || !!data.email, {
  message: 'Either teacherId or email must be provided to reset password',
})

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  let pass = ''
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(randomInt(0, chars.length))
  }
  return pass
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server configuration error: missing Supabase environment variables.' }, { status: 500 })
    }

    // 1. Verify caller is an authenticated Admin
    const adminSupabase = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let callerUser = null
    try {
      const serverSupabase = await createServerClient()
      const { data: userData } = await serverSupabase.auth.getUser()
      callerUser = userData?.user
    } catch (e) {
      // Server session check failed, try bearer token header fallback
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
      return NextResponse.json({ error: 'Unauthorized: No active admin session found.' }, { status: 401 })
    }

    const { data: adminProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle()

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required to reset teacher passwords.' }, { status: 403 })
    }

    // 2. Parse & validate request payload with Zod
    const body = await request.json().catch(() => ({}))
    const parseResult = resetPasswordSchema.safeParse(body)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid password reset payload'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { teacherId, email } = parseResult.data

    // 3. Resolve target user ID & email
    let targetUserId = teacherId
    let targetEmail = email

    if (!targetUserId && targetEmail) {
      const { data: prof } = await adminSupabase.from('profiles').select('id').eq('email', targetEmail.toLowerCase()).maybeSingle()
      if (prof) targetUserId = prof.id
    }

    if (!targetEmail && targetUserId) {
      const { data: prof } = await adminSupabase.from('profiles').select('email').eq('id', targetUserId).maybeSingle()
      if (prof) targetEmail = prof.email
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Teacher account not found.' }, { status: 404 })
    }

    // 4. Generate random temporary password
    const tempPassword = generateTempPassword()

    // 5. Update Auth user's password using Supabase Admin API
    const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      password: tempPassword,
    })

    if (updateAuthError) {
      console.error('[API reset-teacher-password] Auth updateUserById error:', updateAuthError)
      return NextResponse.json({ error: updateAuthError.message || 'Failed to reset teacher password in Auth.' }, { status: 400 })
    }

    // 6. Set must_change_password = true in profiles & allowed_users
    if (targetEmail) {
      await adminSupabase
        .from('allowed_users')
        .update({ must_change_password: true })
        .eq('email', targetEmail.toLowerCase())
    }

    await adminSupabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', targetUserId)

    return NextResponse.json({
      success: true,
      tempPassword,
      email: targetEmail,
      userId: targetUserId,
    })
  } catch (err: any) {
    console.error('[API reset-teacher-password] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Server error resetting teacher password' }, { status: 500 })
  }
}
