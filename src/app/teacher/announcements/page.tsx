import { createClient } from '@/lib/supabase/server'
import TeacherAnnouncementsClient from '@/components/teacher/TeacherAnnouncementsClient'

export const dynamic = 'force-dynamic'

export default async function TeacherAnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userId = user?.id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date()

  // 1. Fetch teacher class IDs & read receipts
  const [{ data: schedule }, { data: reads }] = await Promise.all([
    userId
      ? supabase.from('schedule_assignments').select('class_id').eq('teacher_id', userId)
      : Promise.resolve({ data: [] }),
    userId
      ? supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', userId)
          .gte('read_at', thirtyDaysAgo)
      : Promise.resolve({ data: [] }),
  ])

  const myClassIds = Array.from(new Set(((schedule as any)?.data || schedule || []).map((s: any) => s.class_id).filter(Boolean)))
  const selectFields = 'id, title, body, category, priority, is_pinned, is_published, created_at, target_audience, expiry_date, start_date, end_date, targets:announcement_classes(class_id, class:classes(name))'

  // 2. Parallel DB queries: General + Class-targeted
  const [resGeneral, resClass] = await Promise.all([
    supabase
      .from('announcements')
      .select(selectFields)
      .eq('is_published', true)
      .eq('is_active', true)
      .neq('target_audience', 'class')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),

    myClassIds.length > 0
      ? supabase
          .from('announcement_classes')
          .select(`announcement:announcements!inner(${selectFields})`)
          .in('class_id', myClassIds)
          .eq('announcement.is_published', true)
          .eq('announcement.is_active', true)
      : Promise.resolve({ data: [] })
  ])

  const generalItems = (resGeneral as any)?.data || []
  const classItems = (((resClass as any)?.data || []) as any[]).map(item => item.announcement).filter(Boolean)

  // 3. Merge, deduplicate by ID, apply expiry date check, sort (is_pinned desc, created_at desc), and limit(20)
  const itemMap = new Map<string, any>()
  ;[...generalItems, ...classItems].forEach(item => itemMap.set(item.id, item))

  const validAnns = Array.from(itemMap.values())
    .filter(a => !a.expiry_date || new Date(a.expiry_date) >= now)
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 20)

  const initialData = {
    anns: validAnns,
    readIdsArray: ((reads as any)?.data || reads || []).map((r: any) => r.announcement_id)
  }

  return <TeacherAnnouncementsClient initialData={initialData} />
}
