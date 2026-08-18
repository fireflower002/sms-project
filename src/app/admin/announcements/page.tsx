import { createClient } from '@/lib/supabase/server'
import AdminAnnouncementsClient from '@/components/admin/AdminAnnouncementsClient'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const supabase = await createClient()

  const [{ data }, { count: tc }] = await Promise.all([
    supabase
      .from('announcements')
      .select('*, reads:announcement_reads(count), author:profiles!created_by(full_name), targets:announcement_classes(class:classes(name))')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
  ])

  const initialData = {
    items: data || [],
    totalTeachers: tc || 0,
  }

  return <AdminAnnouncementsClient initialData={initialData} />
}
