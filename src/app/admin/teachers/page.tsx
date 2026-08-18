import { createClient } from '@/lib/supabase/server'
import TeachersClient from '@/components/admin/TeachersClient'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

export default async function TeachersPage() {
  const supabase = await createClient()

  const [
    { data: teachers, count },
    { count: total },
    { count: active },
    { count: inactive },
    { data: pendingData },
    { data: profileEmails }
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'teacher').order('full_name').range(0, PAGE_SIZE - 1),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', false),
    supabase.from('allowed_users').select('*').eq('is_registered', false).order('created_at', { ascending: false }),
    supabase.from('profiles').select('email').eq('role', 'teacher'),
  ])

  const registeredEmails = new Set((profileEmails || []).map(p => p.email?.toLowerCase()))
  const actualPending = (pendingData || []).filter(u => !registeredEmails.has(u.email?.toLowerCase()))

  const initialData = {
    teachers: teachers || [],
    totalCount: count || 0,
    stats: {
      total: total || 0,
      active: active || 0,
      inactive: inactive || 0,
      pending: actualPending.length,
    },
    pending: actualPending,
  }

  return <TeachersClient initialData={initialData} />
}
