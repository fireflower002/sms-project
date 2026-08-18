'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, List, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', transition: 'all 0.15s ease' },
}

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case 'high': return 'danger'
    case 'medium': return 'pending'
    default: return 'inactive'
  }
}

import useSWR from 'swr'

const fetchTeacherAnnouncements = async () => {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { anns: [], readIds: new Set<string>() }

  const [{ data: anns }, { data: reads }, { data: schedule }] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, priority, is_pinned, is_published, created_at, target_type, expires_at, start_date, end_date, targets:announcement_classes(class_id, class:classes(name))')
      .eq('is_published', true)
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('announcement_reads').select('announcement_id').eq('user_id', session.user.id),
    supabase.from('schedule_assignments').select('class_id').eq('teacher_id', session.user.id),
  ])

  const myClassIds = Array.from(new Set((schedule || []).map((s: any) => s.class_id)))
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

  return {
    anns: validAnns,
    readIds: new Set<string>((reads || []).map((r: any) => r.announcement_id))
  }
}

export default function TeacherAnnouncementsPage() {
  const { data: swrData, isLoading: loading } = useSWR('teacher-announcements-feed', fetchTeacherAnnouncements, { revalidateOnFocus: true })
  const items = swrData?.anns || []
  const readIds = swrData?.readIds || new Set<string>()
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const supabase = createClient()
  const router = useRouter()

  const unreadCount = items.filter(i => !readIds.has(i.id)).length
  const filteredItems = filter === 'unread' ? items.filter(i => !readIds.has(i.id)) : items

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '96px' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.skyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={20} style={{ color: H.skyDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Announcements</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
        </div>

        {/* Integrated Filter Toolbar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FAF9F6' }}>
          <button onClick={() => setFilter('unread')} style={{ ...styles.button, background: filter === 'unread' ? H.skyLight : H.surface, color: filter === 'unread' ? H.skyDark : H.textSec, border: `1px solid ${filter === 'unread' ? H.skyBlue : H.border}` }}>
            <Bell size={14} /> Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button onClick={() => setFilter('all')} style={{ ...styles.button, background: filter === 'all' ? H.skyLight : H.surface, color: filter === 'all' ? H.skyDark : H.textSec, border: `1px solid ${filter === 'all' ? H.skyBlue : H.border}` }}>
            <List size={14} /> All Notices
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <LoadingSpinner size={32} color={H.softPink} />
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '20px 0' }}>
              <EmptyState title="All Caught Up!" description="There are no announcements to display for this view." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {filteredItems.map(item => {
                 const isRead = readIds.has(item.id)
                 const classNames = item.targets?.map((t: any) => t.class?.name).filter(Boolean) || [];

                 return (
                   <div key={item.id} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderLeft: `4px solid ${item.priority === 'high' ? H.danger : item.priority === 'medium' ? H.accent : H.border}`, borderRadius: '14px', overflow: 'hidden' }}>
                     <div style={{ padding: '20px 24px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                         {!isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: H.skyBlue, flexShrink: 0 }} title="Unread" />}
                         {item.is_pinned && <Badge variant="pending">Pinned</Badge>}
                         {item.priority && <Badge variant={getPriorityBadgeVariant(item.priority)}>{item.priority} Priority</Badge>}
                         
                         {classNames.length === 0 ? (
                           <Badge variant="category">All Teachers</Badge>
                         ) : (
                           classNames.map((name: string) => (
                             <Badge key={name} variant="pending">{name}</Badge>
                           ))
                         )}

                         <span style={{ fontSize: '12px', color: H.textMuted, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatSLT(item.created_at, 'dd MMM, h:mm a')}</span>
                       </div>
                       <h2 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: '0 0 8px' }}>{item.title}</h2>
                       <p style={{ fontSize: '14px', color: H.textSec, lineHeight: 1.7, margin: 0 }}>{item.body}</p>

                       {/* Relevant Dates info */}
                       {(item.start_date || item.end_date) && (
                         <div style={{ fontSize: '12px', color: H.textSec, background: H.bg, padding: '8px 12px', borderRadius: '8px', marginTop: '12px', display: 'inline-block' }}>
                           <span style={{ fontWeight: 700 }}>Relevant:</span>{' '}
                           {item.start_date ? formatSLT(item.start_date, 'dd MMM yyyy') : 'Start'} to{' '}
                           {item.end_date ? formatSLT(item.end_date, 'dd MMM yyyy') : 'End'}
                         </div>
                       )}
                     </div>
                   </div>
                 )
               })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
