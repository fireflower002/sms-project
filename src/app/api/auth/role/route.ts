import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return NextResponse.json({ success: false, error: 'Unauthenticated' }, { status: 401 })
    }

    const userEmail = user.email?.toLowerCase() || ''

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const { data: allowed } = await supabase
      .from('allowed_users')
      .select('role, must_change_password')
      .eq('email', userEmail)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin' || allowed?.role === 'admin'

    if (isAdmin) {
      if (!profile || profile.role !== 'admin') {
        await supabase.from('profiles').upsert({
          id: user.id,
          email: userEmail,
          full_name: user.user_metadata?.full_name || userEmail.split('@')[0] || 'Admin',
          role: 'admin',
          is_active: true,
        })
      }
      return NextResponse.json({
        success: true,
        data: {
          role: 'admin',
          mustChangePassword: false,
        }
      })
    }

    if (profile?.role) {
      return NextResponse.json({
        success: true,
        data: {
          role: profile.role,
          mustChangePassword: allowed?.must_change_password ?? false,
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        role: 'teacher',
        mustChangePassword: allowed?.must_change_password ?? false,
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
