'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import LoginForm from '@/components/auth/LoginForm'
import { H } from '@/lib/honey'

export default function HomePage() {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          if (mounted) setLoading(false)
          return
        }

        const res = await fetch('/api/auth/role')
        if (res.ok) {
          const roleData = await res.json()
          if (roleData.role) {
            router.push(roleData.role === 'admin' ? '/admin' : '/teacher')
            return
          }
        }

        const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
        if (prof?.role) {
          router.push(prof.role === 'admin' ? '/admin' : '/teacher')
        } else {
          if (mounted) setLoading(false)
        }
      } catch {
        if (mounted) setLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: H.skyBlue, animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  return <LoginForm role="teacher" homePath="/teacher" title="School Management Portal" />
}
