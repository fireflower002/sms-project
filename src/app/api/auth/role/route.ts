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
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }

    const userEmail = user.email?.toLowerCase() || ''
    const isAdminByMetaOrEmail =
      user.user_metadata?.role === 'admin' ||
      userEmail.startsWith('admin') ||
      userEmail.includes('admin@')

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // If profile is admin or metadata/email indicates admin
    if (profile?.role === 'admin' || isAdminByMetaOrEmail) {
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
        role: 'admin',
        mustChangePassword: false,
      })
    }

    if (profile?.role) {
      const { data: allowed } = await supabase
        .from('allowed_users')
        .select('must_change_password')
        .eq('email', userEmail)
        .maybeSingle()

      return NextResponse.json({
        role: profile.role,
        mustChangePassword: allowed?.must_change_password ?? false,
      })
    }

    // Check allowed_users or fallback
    const { data: allowed } = await supabase
      .from('allowed_users')
      .select('must_change_password')
      .eq('email', userEmail)
      .maybeSingle()

    const role = (user.user_metadata?.role as string) || (userEmail.startsWith('admin') ? 'admin' : 'teacher')
    return NextResponse.json({
      role,
      mustChangePassword: allowed?.must_change_password ?? false,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 })
  }
}
