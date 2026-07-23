'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isForcedChange = pathname === '/teacher/change-password'

  useEffect(() => {
    const checkPasswordStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        const { data: allowed } = await supabase
          .from('allowed_users')
          .select('is_registered')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()

        if (allowed && allowed.is_registered === false && pathname !== '/teacher/change-password') {
          router.push('/teacher/change-password')
        }
      }
    }
    checkPasswordStatus()
  }, [pathname, router, supabase])

  if (isForcedChange) {
    return (
      <div style={{ minHeight: '100vh', background: H.bg }}>
        {children}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: H.lightBg }}>
      <TeacherSidebar />
      <div style={{ flex: 1, minWidth: 0, paddingBottom: '96px' }}>
        {children}
      </div>
    </div>
  )
}
