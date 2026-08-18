'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import TeacherSidebar from '@/components/teacher/TeacherSidebar'
import NotificationBell from '@/components/teacher/NotificationBell'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    const checkPasswordStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email) {
        const { data: allowed } = await supabase
          .from('allowed_users')
          .select('is_registered')
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()

        if (allowed && allowed.is_registered === false && pathname !== '/teacher/profile') {
          router.push('/teacher/profile?changePassword=true')
        }
      }
    }
    checkPasswordStatus()
  }, [pathname, router, supabase])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: H.lightBg }}>
      <TeacherSidebar />
      <div className="teacher-main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Persistent Top Header Bar with Notification Bell */}
        <header style={{
          height: '48px',
          padding: '0 20px',
          backgroundColor: H.surface,
          borderBottom: `1px solid ${H.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 900,
        }}>
          <NotificationBell />
        </header>

        <div style={{ flex: 1 }}>
          {children}
        </div>

        <style>{`
          @media (max-width: 767px) {
            .teacher-main-content {
              padding-bottom: calc(90px + env(safe-area-inset-bottom));
            }
            .teacher-main-content:has(.staff-chat-header) {
              padding-bottom: 0 !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
