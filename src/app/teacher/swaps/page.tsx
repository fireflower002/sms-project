'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Inbox,
  Send,
  UserCheck
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

interface SwapRecord {
  id: string
  requester_id: string
  target_teacher_id: string
  requester_period: number
  target_period: number
  requester_class_id?: string | null
  target_class_id?: string | null
  swap_date: string
  status: 'pending' | 'peer_accepted' | 'peer_rejected' | 'accepted' | 'rejected' | 'cancelled'
  note?: string | null
  created_at: string
  peer_responded_at?: string | null
  requester?: { full_name: string } | null
  target?: { full_name: string } | null
  requester_class?: { name: string } | null
  target_class?: { name: string } | null
}

const SWAP_STATUS_VARIANTS: Record<
  SwapRecord['status'],
  { label: string; bg: string; color: string; border: string }
> = {
  pending: { label: 'Pending Peer Review', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  peer_accepted: { label: 'Peer Accepted (Awaiting Admin)', bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC' },
  peer_rejected: { label: 'Peer Declined', bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
  accepted: { label: 'Approved & Finalized', bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' },
  rejected: { label: 'Admin Rejected', bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
  cancelled: { label: 'Cancelled', bg: '#F3F4F6', color: '#4B5563', border: '#D1D5DB' },
}

function TeacherSwapsContent() {
  const searchParams = useSearchParams()
  const justCreated = searchParams.get('created') === 'true'

  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [swaps, setSwaps] = useState<SwapRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionProcessing, setActionProcessing] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(justCreated ? 'Swap request submitted successfully!' : null)

  // Fetch Swaps
  const fetchSwaps = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUser(user)

      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!requester_id(full_name),
          target:profiles!target_teacher_id(full_name),
          requester_class:classes!requester_class_id(name),
          target_class:classes!target_class_id(name)
        `)
        .or(`requester_id.eq.${user.id},target_teacher_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setSwaps(data || [])
    } catch (err: any) {
      console.error('[TeacherSwapsPage] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchSwaps()
  }, [fetchSwaps])

  // Handle Peer Decision (Accept / Reject)
  const handlePeerDecision = async (swap: SwapRecord, accept: boolean) => {
    setActionProcessing(swap.id)
    try {
      const newStatus = accept ? 'peer_accepted' : 'peer_rejected'
      const nowIso = new Date().toISOString()

      const { error: updateErr } = await supabase
        .from('swap_requests')
        .update({
          status: newStatus,
          peer_responded_at: nowIso,
        })
        .eq('id', swap.id)
        .eq('target_teacher_id', currentUser.id)

      if (updateErr) throw updateErr

      // Dispatch Notification to Requester
      await supabase.from('notifications').insert({
        user_id: swap.requester_id,
        type: 'swap_response',
        title: accept ? 'Class Swap Accepted by Peer' : 'Class Swap Declined',
        body: accept
          ? `${currentUser.email || 'Peer teacher'} accepted your swap request for ${swap.swap_date}. Awaiting admin final approval.`
          : `${currentUser.email || 'Peer teacher'} declined your swap request for ${swap.swap_date}.`,
        link: '/teacher/swaps',
        is_read: false
      })

      setToastMessage(accept ? 'Swap request accepted! Sent to Admin for final approval.' : 'Swap request declined.')
      fetchSwaps()
    } catch (err: any) {
      console.error('Error updating swap request:', err)
      setToastMessage('Could not update swap request. Please try again.')
    } finally {
      setActionProcessing(null)
    }
  }

  // Handle Requester Cancel
  const handleCancelRequest = async (swap: SwapRecord) => {
    setActionProcessing(swap.id)
    try {
      const { error: updateErr } = await supabase
        .from('swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', swap.id)
        .eq('requester_id', currentUser.id)

      if (updateErr) throw updateErr

      setToastMessage('Swap request cancelled.')
      fetchSwaps()
    } catch (err: any) {
      console.error('Error cancelling swap request:', err)
      setToastMessage('Could not cancel swap request. Please try again.')
    } finally {
      setActionProcessing(null)
    }
  }

  const incomingSwaps = swaps.filter(s => currentUser && s.target_teacher_id === currentUser.id)
  const outgoingSwaps = swaps.filter(s => currentUser && s.requester_id === currentUser.id)

  const pendingIncomingCount = incomingSwaps.filter(s => s.status === 'pending').length

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Top Toast Alert */}
        {toastMessage && (
          <div style={{ backgroundColor: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: H.radius.md, padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#059669', fontSize: '13px', fontWeight: 600 }}>
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', fontWeight: 800 }}>✕</button>
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowRightLeft size={26} style={{ color: H.purple }} />
              Class Swap Requests
            </h1>
            <p style={{ fontSize: '14px', color: H.textSec, margin: '4px 0 0' }}>
              Exchange periods with fellow staff members and track request status.
            </p>
          </div>

          <Link
            href="/teacher/swaps/new"
            style={{
              height: H.targetSizes.buttonMd,
              padding: '0 18px',
              borderRadius: H.radius.lg,
              backgroundColor: H.purple,
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              boxShadow: H.shadows.sm
            }}
          >
            <Plus size={16} /> Request Class Swap
          </Link>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: `1px solid ${H.border}`, paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('incoming')}
            style={{
              padding: '8px 16px',
              borderRadius: H.radius.md,
              border: 'none',
              backgroundColor: activeTab === 'incoming' ? H.surface : 'transparent',
              color: activeTab === 'incoming' ? H.purple : H.textSec,
              fontWeight: activeTab === 'incoming' ? 800 : 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeTab === 'incoming' ? H.shadows.sm : 'none'
            }}
          >
            <Inbox size={16} /> Received Requests
            {pendingIncomingCount > 0 && (
              <span style={{ backgroundColor: H.danger, color: '#FFF', fontSize: '11px', fontWeight: 800, padding: '2px 7px', borderRadius: '99px' }}>
                {pendingIncomingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('outgoing')}
            style={{
              padding: '8px 16px',
              borderRadius: H.radius.md,
              border: 'none',
              backgroundColor: activeTab === 'outgoing' ? H.surface : 'transparent',
              color: activeTab === 'outgoing' ? H.purple : H.textSec,
              fontWeight: activeTab === 'outgoing' ? 800 : 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeTab === 'outgoing' ? H.shadows.sm : 'none'
            }}
          >
            <Send size={16} /> Sent Requests ({outgoingSwaps.length})
          </button>
        </div>

        {/* Content Section */}
        {loading ? (
          <LoadingSpinner centered size={32} color={H.purple} />
        ) : activeTab === 'incoming' ? (

          /* INCOMING REQUESTS */
          incomingSwaps.length === 0 ? (
            <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '40px 20px' }}>
              <EmptyState
                title="No Incoming Swap Requests"
                description="When another teacher requests a period exchange with you, it will appear here for your review."
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {incomingSwaps.map(swap => {
                const statusCfg = SWAP_STATUS_VARIANTS[swap.status] || SWAP_STATUS_VARIANTS.pending
                const isProcessing = actionProcessing === swap.id

                return (
                  <div key={swap.id} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, overflow: 'hidden', boxShadow: H.shadows.card }}>

                    {/* Header */}
                    <div style={{ padding: '14px 20px', backgroundColor: H.bg, borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '99px', backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                        {statusCfg.label}
                      </span>
                      <span style={{ fontSize: '12px', color: H.textMuted }}>Date of Swap: <strong>{swap.swap_date}</strong></span>
                    </div>

                    {/* Body Grid */}
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>Requester</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, color: H.textPrimary }}>{swap.requester?.full_name || 'Staff Member'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: H.textSec }}>
                          Period {swap.requester_period} {swap.requester_class?.name ? `(${swap.requester_class.name})` : ''}
                        </p>
                      </div>

                      <ArrowRightLeft size={20} style={{ color: H.purple }} />

                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>You (Target)</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, color: H.textPrimary }}>You</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: H.textSec }}>
                          Period {swap.target_period} {swap.target_class?.name ? `(${swap.target_class.name})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Note if any */}
                    {swap.note && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '12px 20px', fontSize: '13px', fontStyle: 'italic', color: H.textSec, backgroundColor: H.bg }}>
                        "{swap.note}"
                      </div>
                    )}

                    {/* Actions for Pending */}
                    {swap.status === 'pending' && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: H.surface }}>
                        <button
                          onClick={() => handlePeerDecision(swap, false)}
                          disabled={isProcessing}
                          style={{
                            padding: '8px 16px',
                            borderRadius: H.radius.md,
                            border: `1px solid ${H.dangerLight}`,
                            backgroundColor: H.dangerLight,
                            color: H.danger,
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          Decline Request
                        </button>
                        <button
                          onClick={() => handlePeerDecision(swap, true)}
                          disabled={isProcessing}
                          style={{
                            padding: '8px 20px',
                            borderRadius: H.radius.md,
                            backgroundColor: H.purple,
                            color: '#FFFFFF',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          {isProcessing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={15} />}
                          Accept Swap
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )

        ) : (

          /* OUTGOING REQUESTS */
          outgoingSwaps.length === 0 ? (
            <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, padding: '40px 20px' }}>
              <EmptyState
                title="No Sent Swap Requests"
                description="You have not requested any class swaps. Click '+ Request Class Swap' above to create a new request."
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {outgoingSwaps.map(swap => {
                const statusCfg = SWAP_STATUS_VARIANTS[swap.status] || SWAP_STATUS_VARIANTS.pending
                const isProcessing = actionProcessing === swap.id

                return (
                  <div key={swap.id} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: H.radius.xl, overflow: 'hidden', boxShadow: H.shadows.card }}>

                    {/* Header */}
                    <div style={{ padding: '14px 20px', backgroundColor: H.bg, borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '99px', backgroundColor: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }}>
                        {statusCfg.label}
                      </span>
                      <span style={{ fontSize: '12px', color: H.textMuted }}>Date of Swap: <strong>{swap.swap_date}</strong></span>
                    </div>

                    {/* Body Grid */}
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>You (Requester)</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, color: H.textPrimary }}>You</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: H.textSec }}>
                          Period {swap.requester_period} {swap.requester_class?.name ? `(${swap.requester_class.name})` : ''}
                        </p>
                      </div>

                      <ArrowRightLeft size={20} style={{ color: H.skyDark }} />

                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>Target Teacher</span>
                        <p style={{ margin: '4px 0 0', fontWeight: 700, color: H.textPrimary }}>{swap.target?.full_name || 'Staff Member'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: H.textSec }}>
                          Period {swap.target_period} {swap.target_class?.name ? `(${swap.target_class.name})` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Note if any */}
                    {swap.note && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '12px 20px', fontSize: '13px', fontStyle: 'italic', color: H.textSec, backgroundColor: H.bg }}>
                        "{swap.note}"
                      </div>
                    )}

                    {/* Cancel Action for Pending */}
                    {swap.status === 'pending' && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', backgroundColor: H.surface }}>
                        <button
                          onClick={() => handleCancelRequest(swap)}
                          disabled={isProcessing}
                          style={{
                            padding: '8px 16px',
                            borderRadius: H.radius.md,
                            border: `1px solid ${H.border}`,
                            backgroundColor: H.bg,
                            color: H.textSec,
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer'
                          }}
                        >
                          {isProcessing ? 'Cancelling...' : 'Cancel Request'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )

        )}

      </div>
    </div>
  )
}

export default function TeacherSwapsPage() {
  return (
    <Suspense fallback={<LoadingSpinner centered size={32} color={H.purple} />}>
      <TeacherSwapsContent />
    </Suspense>
  )
}
