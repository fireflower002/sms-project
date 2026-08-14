import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSiteUrl } from '@/lib/siteUrl'

const teacherRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address format'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const parseResult = teacherRegisterSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid email address'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { email } = parseResult.data

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    const dbClient = (supabaseUrl && serviceRoleKey)
      ? createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : await createServerClient()

    // 1. Verify email is in allowed_users
    const { data: allowed, error: lookupErr } = await dbClient
      .from('allowed_users')
      .select('email, full_name, is_registered')
      .eq('email', email)
      .maybeSingle()

    if (lookupErr || !allowed) {
      return NextResponse.json({
        error: 'This email has not been added by an administrator. Contact your school admin to be registered.'
      }, { status: 403 })
    }

    if (allowed.is_registered) {
      return NextResponse.json({
        error: 'An account already exists for this email. Please sign in instead.'
      }, { status: 400 })
    }

    // 2. Send magic link or password setup link via Supabase Auth
    const redirectUrl = `${getSiteUrl()}/reset-password`
    const serverSupabase = await createServerClient()
    const { error: resetErr } = await serverSupabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (resetErr) {
      console.error('[API teacher-register] Auth resetPasswordForEmail error:', resetErr)
      return NextResponse.json({ error: resetErr.message || 'Failed to send registration link' }, { status: 500 })
    }

    return NextResponse.json({ success: true, email })
  } catch (err: any) {
    console.error('[API teacher-register] Unexpected error:', err)
    return NextResponse.json({ error: err?.message || 'Server error during registration' }, { status: 500 })
  }
}
