import { createClient } from '@/lib/supabase/server'
import StaffChatClient from '@/components/chat/StaffChatClient'

export const dynamic = 'force-dynamic'

export default async function TeacherStaffChatPage() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: rawMessages }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('hive_messages')
      .select('id, sender_id, body, created_at, profiles!sender_id(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(35),
  ])

  let initialUser = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    initialUser = {
      id: user.id,
      full_name: profile?.full_name || user.email || 'Staff Member',
      role: profile?.role || 'teacher',
    }
  }

  const initialMessages = (rawMessages || []).map((m: any) => {
    const rawAuthor = m.profiles
    const authorObj = Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor
    return {
      id: m.id,
      sender_id: m.sender_id,
      body: m.body,
      created_at: m.created_at,
      is_edited: m.is_edited || false,
      updated_at: m.updated_at || null,
      is_deleted: m.is_deleted || false,
      deleted_at: m.deleted_at || null,
      author: {
        full_name: authorObj?.full_name || 'Staff Member',
        role: authorObj?.role || 'teacher',
      },
    }
  }).reverse()

  return <StaffChatClient initialMessages={initialMessages} initialUser={initialUser} isTeacher={true} />
}
