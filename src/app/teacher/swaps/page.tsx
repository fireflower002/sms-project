'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, XCircle, ArrowRightLeft, Plus } from 'lucide-react'
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
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.15s ease', textDecoration: 'none', minHeight: '40px' },
  buttonPrimary: { background: H.skyBlue, color: '#FFFFFF' },
  buttonSuccess: { background: H.successLight, color: H.grass, border: `1px solid ${H.grass}40` },
  buttonDanger: { background: H.dangerLight, color: H.danger, border: `1px solid ${H.danger}40` },
}

const getBadgeVariant = (status: string) => {
  switch (status) {
    case 'pending': return 'pending'
    case 'peer_accepted': return 'category'
    case 'accepted': return 'active'
    case 'rejected':
    case 'peer_rejected': return 'danger'
    default: return 'inactive'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'Awaiting Peer'
    case 'peer_accepted': return 'Awaiting Admin'
    case 'accepted': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'peer_rejected': return 'Peer Declined'
    default: return 'Cancelled'
  }
}

export default function TeacherSwapsPage() {
  const [swaps, setSwaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const supabase = createClient()
  const router = useRouter()

  const fetchSwaps = useCallback(async (uid: string) => {
    setLoading(true)
    let query = supabase.from('swap_requests')
      .select('*, requester:profiles!requester_id(full_name), target:profiles!target_teacher_id(full_name), requester_class:classes!requester_class_id(name), target_class:classes!target_class_id(name)')
      .or(`requester_id.eq.${uid},target_teacher_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    if (filter === 'active') query = query.in('status', ['pending', 'peer_accepted'])
    const { data } = await query
    setSwaps(data || [])
    setLoading(false)
  }, [filter, supabase])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/teacher/login'); return }
      setUserId(session.user.id)
      fetchSwaps(session.user.id)
    }
    init()
  }, [fetchSwaps, router, supabase])

  const handleAction = async (id: string, newStatus: string) => {
    setProcessing(id)
    await supabase.from('swap_requests').update({ status: newStatus, peer_responded_at: new Date().toISOString() }).eq('id', id)
    if (userId) fetchSwaps(userId)
    setProcessing(null)
  }

  const incomingPendingCount = swaps.filter(s => s.target_teacher_id === userId && s.status === 'pending').length

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '48px' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FDE8D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={20} style={{ color: '#C2410C' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Class Swaps</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                {incomingPendingCount > 0 ? `${incomingPendingCount} swap requests need your response` : 'Manage your class swap requests'}
              </p>
            </div>
          </div>
          <Link href="/teacher/swaps/new" style={{ ...styles.button, ...styles.buttonPrimary, borderRadius: '10px', minHeight: '38px', fontSize: '13px' }}>
            <Plus size={14} /> New Swap Request
          </Link>
        </div>

        {/* Integrated Filter Toolbar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FAF9F6' }}>
          {(['active', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...styles.button, background: filter === f ? H.skyLight : H.surface, color: filter === f ? H.skyDark : H.textSec, border: `1px solid ${filter === f ? H.skyBlue : H.border}` }}>
              {f === 'active' ? 'Active Requests' : 'All History'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <LoadingSpinner size={32} color={H.skyBlue} />
            </div>
          ) : swaps.length === 0 ? (
            <div style={{ padding: '20px 0' }}>
              <EmptyState title="No Swaps Found" description={`You have no ${filter === 'active' ? 'active' : ''} swap requests.`} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {swaps.map(swap => {
                const isTarget = swap.target_teacher_id === userId
                const isRequester = swap.requester_id === userId
                const isPendingTarget = isTarget && swap.status === 'pending'

                return (
                  <div key={swap.id} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Badge variant={getBadgeVariant(swap.status)}>
                          {getStatusLabel(swap.status)}
                        </Badge>
                        <span style={{ fontSize: '12px', color: H.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                          {formatSLT(swap.created_at, 'dd MMM yyyy, h:mm a')}
                        </span>
                      </div>

                      {isPendingTarget && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleAction(swap.id, 'peer_accepted')} disabled={processing === swap.id} style={{ ...styles.button, ...styles.buttonSuccess }}>
                            {processing === swap.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />}
                            Accept
                          </button>
                          <button onClick={() => handleAction(swap.id, 'peer_rejected')} disabled={processing === swap.id} style={{ ...styles.button, ...styles.buttonDanger }}>
                            {processing === swap.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} />}
                            Decline
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', background: H.bg, padding: '14px', borderRadius: '12px', border: `1px solid ${H.border}` }}>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Requester</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '14px', color: H.textPrimary }}>{swap.requester?.full_name} {isRequester && '(You)'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: H.textSec }}>Date: {swap.swap_date ? formatSLT(swap.swap_date, 'dd MMM yyyy') : 'N/A'} · P{swap.requester_period} ({swap.requester_class?.name || 'Class'})</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowRightLeft size={20} style={{ color: H.skyBlue }} />
                      </div>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Teacher</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '14px', color: H.textPrimary }}>{swap.target?.full_name} {isTarget && '(You)'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: H.textSec }}>Target P{swap.target_period} ({swap.target_class?.name || 'Class'})</p>
                      </div>
                    </div>

                    {swap.note && (
                      <p style={{ margin: '14px 0 0', fontSize: '13px', color: H.textSec }}>
                        <strong>Note:</strong> {swap.note}
                      </p>
                    )}
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
