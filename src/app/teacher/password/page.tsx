'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { H } from '@/lib/honey'

export default function RedirectPasswordPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/teacher/profile?changePassword=true')
  }, [router])

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: H.font }}>
      <LoadingSpinner size={32} color={H.grass} />
    </div>
  )
}
