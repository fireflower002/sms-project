import { redirect } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import LoginForm from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Read secure app_metadata claim first
    const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string)
    if (role === 'admin') {
      redirect('/admin')
    } else if (role === 'teacher') {
      redirect('/teacher')
    }

    // Database fallback if claims not populated
    const { data: prof } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (prof?.role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/teacher')
    }
  }

  return <LoginForm role="teacher" homePath="/teacher" title="School Management Portal" />
}
