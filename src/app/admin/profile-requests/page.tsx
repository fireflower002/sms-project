import { createClient } from '@/lib/supabase/server'
import ProfileRequestsClient from '@/components/admin/ProfileRequestsClient'

export const dynamic = 'force-dynamic'

export default async function ProfileRequestsPage() {
  const supabase = await createClient()

  const [reqRes, p, a, r] = await Promise.all([
    supabase.from('profile_change_requests').select('*, teacher:profiles!teacher_id(id,full_name,email,subjects,phone)').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ])

  const initialData = {
    requests: reqRes.data || [],
    stats: { pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 },
  }

  return <ProfileRequestsClient initialData={initialData} />
}
