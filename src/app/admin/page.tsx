import { createClient } from '@/lib/supabase/server'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userData = null
  let stats = { teachers: 0, classes: 0, items: 0 }
  let todaysAbsences: any[] = []
  let pending = { swaps: 0, requests: 0 }
  let activeTimetable: any = null

  if (user) {
    let absenceRes: any = await supabase.from('absences').select('id, absence_date, reason, created_at, status, teacher:profiles!teacher_id(full_name)').not('template_id', 'is', null).order('absence_date', { ascending: false }).limit(10)
    if (absenceRes.error) {
      absenceRes = await supabase.from('absences').select('id, absence_date, reason, created_at, status, profiles(full_name)').not('template_id', 'is', null).order('absence_date', { ascending: false }).limit(10)
    }

    const [
      userRes,
      teacherStats,
      classStats,
      itemStats,
      swapData,
      requestData,
      timetableRes
    ] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
      supabase.from('classes').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('inventory').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('swap_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profile_change_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('timetable_templates').select('id, name').eq('is_active', true).maybeSingle(),
    ])

    userData = userRes.data
    stats = { teachers: teacherStats.count || 0, classes: classStats.count || 0, items: itemStats.count || 0 }
    todaysAbsences = absenceRes.data || []
    pending = { swaps: swapData.count || 0, requests: requestData.count || 0 }

    let activeTmpl = timetableRes?.data
    if (!activeTmpl) {
      const { data: fallbackTmpl } = await supabase.from('timetable_templates').select('id, name').order('created_at', { ascending: false }).limit(1).maybeSingle()
      activeTmpl = fallbackTmpl
    }
    activeTimetable = activeTmpl
  }

  const initialData = user ? {
    user: userData,
    stats,
    todaysAbsences,
    pending,
    activeTimetable
  } : undefined

  return <AdminDashboardClient initialData={initialData} />
}
