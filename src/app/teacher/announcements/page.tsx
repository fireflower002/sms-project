import { createClient } from '@/lib/supabase/server'
import TeacherAnnouncementsClient from '@/components/teacher/TeacherAnnouncementsClient'

export const dynamic = 'force-dynamic'

export default async function TeacherAnnouncementsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const userId = session?.user?.id
  const [{ data: anns }, { data: reads }, { data: schedule }] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, priority, is_pinned, is_published, created_at, target_type, expires_at, start_date, end_date, targets:announcement_classes(class_id, class:classes(name))')
      .eq('is_published', true)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    userId ? supabase.from('announcement_reads').select('announcement_id').eq('user_id', userId) : Promise.resolve({ data: [] }),
    userId ? supabase.from('schedule_assignments').select('class_id').eq('teacher_id', userId) : Promise.resolve({ data: [] }),
  ])

  const myClassIds = Array.from(new Set(((schedule as any)?.data || schedule || []).map((s: any) => s.class_id)))
  const now = new Date()

  const validAnns = (anns || []).filter((a: any) => {
    if (a.expires_at && new Date(a.expires_at) < now) return false
    if (a.target_type === 'all') return true
    if (a.target_type === 'role_teachers') return true
    if (a.target_type === 'specific_classes') {
      const targetClassIds = (a.targets || []).map((t: any) => t.class_id)
      return targetClassIds.some((id: string) => myClassIds.includes(id))
    }
    return true
  })

  const initialData = {
    anns: validAnns,
    readIdsArray: ((reads as any)?.data || reads || []).map((r: any) => r.announcement_id)
  }

  return <TeacherAnnouncementsClient initialData={initialData} />
}
