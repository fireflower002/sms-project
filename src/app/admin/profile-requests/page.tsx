'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, ArrowRight, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: '32px' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', padding: '10px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'opacity 0.2s ease', textDecoration: 'none' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
  buttonSuccess: { background: H.successGreen, color: 'white' },
  buttonDanger: { background: H.dangerLight, color: H.danger },
  // Stat Cards
  statCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '24px' },
  statCard: { padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', },
  statCardIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statCardValue: { fontSize: '28px', fontWeight: 800, color: H.textPrimary, lineHeight: 1 },
  statCardLabel: { fontSize: '13px', fontWeight: 600, color: H.textSec, marginTop: '2px' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' },
};

const STATUS_STYLES: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: { label: 'Pending', style: { ...styles.badge, background: H.skyLight, color: H.skyDark } },
  approved: { label: 'Approved', style: { ...styles.badge, background: H.successLight, color: '#065F46' } },
  rejected: { label: 'Rejected', style: { ...styles.badge, background: H.dangerLight, color: H.danger } },
};

const DiffField = ({ label, oldValue, newValue }: { label: string; oldValue: any; newValue: any }) => (
    <div style={{ background: H.bg, padding: '12px', borderRadius: '12px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
            <span style={{ color: H.danger, textDecoration: 'line-through', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oldValue}</span>
            <ArrowRight size={16} style={{ color: H.textMuted, flexShrink: 0 }} />
            <span style={{ color: '#065F46', fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{newValue}</span>
        </div>
    </div>
);

import { useToast } from '@/components/ui/Toast'

// MAIN PAGE COMPONENT ========================================================
export default function ProfileRequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [adminNote, setAdminNote] = useState<Record<string, string>>({})
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 })
  const supabase = createClient();
  const { showToast } = useToast();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('profile_change_requests').select('*, teacher:profiles!teacher_id(id,full_name,email,subjects,phone)').order('created_at', { ascending: false });
    if (filter === 'pending') query = query.eq('status', 'pending');
    const { data } = await query;
    setRequests(data || []);

    const [p, a, r] = await Promise.all([
      supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profile_change_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);
    setStats({ pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 });
    setLoading(false);
  }, [filter, supabase]);

  useEffect(() => { fetchRequests() }, [fetchRequests]);

  const handleReview = async (req: any, approved: boolean) => {
    setProcessing(req.id);
    const { data: { session } } = await supabase.auth.getSession();
    const reviewerId = session?.user?.id;
    
    if (approved) {
        const updates: Record<string, any> = {};
        if (req.new_full_name !== null) updates.full_name = req.new_full_name;
        if (req.new_phone !== null) updates.phone = req.new_phone;
        if (req.new_subjects !== null) updates.subjects = req.new_subjects;
        
        const { error: profError } = await supabase.from('profiles').update(updates).eq('id', req.teacher_id);
        if (profError) {
          console.error('Failed to update teacher profile:', profError.message);
          showToast('Unable to save profile updates. Please try again.', 'error');
          setProcessing(null);
          return;
        }
    }
    
    const { error: reqError } = await supabase.from('profile_change_requests').update({
        status: approved ? 'approved' : 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        admin_note: adminNote[req.id] || null
    }).eq('id', req.id);
    
    if (reqError) {
      console.error('Failed to update change request status:', reqError.message);
      showToast('Unable to update request status. Please try again.', 'error');
    } else {
      showToast(approved ? 'Profile change request approved!' : 'Profile change request rejected.', approved ? 'success' : 'info');
    }
    
    setProcessing(null);
    fetchRequests();
  };

  const getDiffs = (req: any) => [
    { cond: req.new_full_name !== null, label: 'Full Name', old: req.teacher?.full_name || '—', new: req.new_full_name },
    { cond: req.new_phone !== null, label: 'Phone Number', old: req.teacher?.phone || '—', new: req.new_phone },
    { cond: req.new_subjects !== null, label: 'Subjects', old: (req.teacher?.subjects || []).join(', ') || '—', new: (req.new_subjects || []).join(', ') },
  ].filter(f => f.cond);

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
        
        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCog size={20} style={{ color: '#18181B' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Profile Change Requests</h1>
              <p style={{ fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Review teacher account profile updates • {stats.pending} pending approval
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={fetchRequests} style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 12px' }} title="Refresh">
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>
        </div>

        {/* Contiguous Metric Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface }}>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={18} style={{ color: '#18181B' }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.pending}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Pending Review</div>
            </div>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', borderRight: `1px solid ${H.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.successLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} style={{ color: '#065F46' }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.approved}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Approved</div>
            </div>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.dangerLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={18} style={{ color: H.danger }} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: H.textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.rejected}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Rejected</div>
            </div>
          </div>
        </div>

        {/* Integrated Filter Toolbar */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: '8px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAFAFA' }}>
          {(['pending', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
              border: filter === f ? `1px solid ${H.border}` : 'none',
              background: filter === f ? H.surface : 'transparent',
              color: filter === f ? H.textPrimary : H.textSec
            }}>
              {f === 'pending' ? 'Pending Requests' : 'All Requests'}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: H.textMuted }}>
              <LoadingSpinner size={28} />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState title="All Clear!" description="No profile change requests match the current filter." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {requests.map(req => {
                const diffs = getDiffs(req);
                const status = STATUS_STYLES[req.status] || {};
                const isBusy = processing === req.id;
                return (
                  <div key={req.id} style={{ ...styles.card, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF9F6' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary, margin: 0 }}>{req.teacher?.full_name}</p>
                        <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0' }}>{req.teacher?.email}</p>
                      </div>
                      <Badge variant={req.status === 'pending' ? 'pending' : req.status === 'approved' ? 'active' : 'danger'}>{status.label}</Badge>
                    </div>
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {diffs.map(d => <DiffField key={d.label} label={d.label} oldValue={d.old} newValue={d.new} />)}
                    </div>
                    {req.status === 'pending' && (
                      <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 20px', background: H.bg, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <textarea value={adminNote[req.id] || ''} onChange={e => setAdminNote(p => ({ ...p, [req.id]: e.target.value }))} placeholder="Add an optional note for the teacher..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${H.border}`, background: H.surface, color: H.textPrimary, fontSize: '13px', outline: 'none', minHeight: '50px', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button onClick={() => handleReview(req, false)} disabled={isBusy} style={{ ...styles.button, ...styles.buttonDanger, minHeight: '36px', fontSize: '13px' }}>{isBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Reject'}</button>
                          <button onClick={() => handleReview(req, true)} disabled={isBusy} style={{ ...styles.button, ...styles.buttonSuccess, minHeight: '36px', fontSize: '13px' }}>{isBusy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Approve'}</button>
                        </div>
                      </div>
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
