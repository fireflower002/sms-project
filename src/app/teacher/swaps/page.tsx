import { createClient } from '@/lib/supabase/server'
import TeacherSwapsClient from '@/components/teacher/TeacherSwapsClient'

export const dynamic = 'force-dynamic'

export default async function TeacherSwapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <TeacherSwapsClient initialData={{ user: null, swaps: [] }} />

  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      id, requester_id, target_teacher_id, requester_period, target_period, requester_class_id, target_class_id, swap_date, status, note, created_at, peer_responded_at,
      requester:profiles!requester_id(full_name),
      target:profiles!target_teacher_id(full_name),
      requester_class:classes!requester_class_id(name),
      target_class:classes!target_class_id(name)
    `)
    .or(`requester_id.eq.${user.id},target_teacher_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .range(0, 19)

  const initialData = { user, swaps: data || [] }

  return <TeacherSwapsClient initialData={initialData} />
}
