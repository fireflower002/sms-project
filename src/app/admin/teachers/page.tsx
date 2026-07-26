'use client'
import { useEffect, useState, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, Search, Upload, Plus, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Trash2, Users, Mail, Calendar, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AddTeacherModal from '@/components/admin/AddTeacherModal'
import TeacherActions from '@/components/admin/TeacherActions'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { TableSkeleton } from '@/components/ui/Skeleton'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import { exportToCSV } from '@/lib/csvExport'
import { useToast } from '@/components/ui/Toast'

const PAGE_SIZE = 10;

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 4vw, 32px)', boxSizing: 'border-box' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0 0' },
  actionsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  // Table
  tableWrapper: { overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '600px', borderCollapse: 'collapse' },
  th: { fontSize: H.fontSize.xs, fontWeight: H.fontWeight.bold, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: `${H.spacing.sm} ${H.spacing.lg}`, textAlign: 'left', borderBottom: `1px solid ${H.border}`, whiteSpace: 'nowrap' },
  td: { padding: `${H.spacing.md} ${H.spacing.lg}`, fontSize: H.fontSize.base, color: H.textSec, borderBottom: `1px solid ${H.border}`, whiteSpace: 'nowrap' },
  trHover: { backgroundColor: H.bg },
  // Badges
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 },
  badgeActive: { backgroundColor: H.successLight, color: '#065F46' },
  badgeInactive: { backgroundColor: '#F5F5F4', color: H.textSec },
  badgePending: { backgroundColor: H.accentLight, color: H.accentDark },
  // Buttons
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', minHeight: '44px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: H.successGreen, color: '#FFFFFF' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
  // Filters
  filterContainer: { display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  // Pagination
  paginationContainer: { padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' },
  paginationText: { fontSize: '13px', color: H.textSec },
};

// SUB-COMPONENTS ==============================================================

const PageHeader = ({ stats, onRefresh, onAddSuccess }: { stats: any; onRefresh: () => void; onAddSuccess: () => void }) => (
  <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Users size={20} style={{ color: '#0E7490' }} />
      </div>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Teacher Management</h1>
        <p style={{ fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          {stats.total} total staff • {stats.active} active • {stats.pending} pending
        </p>
      </div>
    </div>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
      <button onClick={onRefresh} title="Refresh" style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 12px', minHeight: '38px' }}>
        <RefreshCw size={14} />
      </button>
      <Link href="/admin/teachers/bulk" style={{ ...styles.button, ...styles.buttonSecondary, borderRadius: '10px', minHeight: '38px', fontSize: '13px' }}>
        <Upload size={14} /> Bulk Import
      </Link>
      <AddTeacherModal onSuccess={onAddSuccess} />
    </div>
  </div>
);

const FilterControls = ({ search, setSearch, statusFilter, setStatusFilter, onExport }: { search: string; setSearch: (s: string) => void; statusFilter: string; setStatusFilter: (s: any) => void; onExport: () => void }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <div style={{ padding: '12px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' }}>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: '1 1 300px' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, color: H.textMuted, pointerEvents: 'none' }} />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by teacher name..." style={{ width: '100%', minHeight: '38px', padding: '8px 14px 8px 36px', borderRadius: '8px', border: `1px solid ${isFocused ? H.successGreen : H.border}`, background: H.surface, color: H.textPrimary, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} />
        </div>
        <div style={{ display: 'flex', border: `1px solid ${H.border}`, borderRadius: '8px', overflow: 'hidden', minHeight: '38px' }}>
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '7px 16px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
              border: 'none', borderLeft: s !== 'all' ? `1px solid ${H.border}` : 'none',
              background: statusFilter === s ? H.surface : H.bg,
              color: statusFilter === s ? H.textPrimary : H.textSec, textTransform: 'capitalize',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}>{s}</button>
          ))}
        </div>
      </div>
      <button
        onClick={onExport}
        style={{
          padding: '8px 14px',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          borderRadius: '8px',
          border: `1px solid ${H.border}`,
          backgroundColor: H.surface,
          color: H.textPrimary,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '38px',
        }}
        title="Export CSV"
      >
        <Download size={14} /> Export CSV
      </button>
    </div>
  );
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

const TeachersTable = ({ teachers, onActionDone }: { teachers: any[]; onActionDone: () => void }) => {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (teachers.length === 0) return <p style={{ textAlign: 'center', padding: '48px', color: H.textMuted }}>No teachers match the current filters.</p>;
  
  if (isMobile) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {teachers.map((t: any) => (
          <div key={t.id} style={{
            backgroundColor: H.surface,
            border: `1px solid ${H.border}`,
            borderRadius: '14px',
            padding: '16px',
            boxShadow: H.cardShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: H.textPrimary, margin: 0 }}>{t.full_name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: H.textSec, marginTop: '4px' }}>
                  <Mail size={13} style={{ color: H.textMuted, flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-all' }}>{t.email}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {t.must_change_password ? (
                  <Badge variant="pending">Reset Req.</Badge>
                ) : t.is_active ? (
                  <Badge variant="active">Active</Badge>
                ) : (
                  <Badge variant="inactive">Inactive</Badge>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: H.textMuted }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> Joined {new Date(t.created_at).toLocaleDateString('en-GB')}
              </span>
            </div>

            <div style={{ borderTop: `1px solid ${H.border}`, paddingTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <TeacherActions teacherId={t.id} isActive={t.is_active} teacherName={t.full_name} onDone={onActionDone} />
              <Link href={`/admin/teachers/${t.id}`} style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 14px', fontSize: '13px', minHeight: '36px' }}>
                View Profile <ChevronRight size={15}/>
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead><tr>
          <th style={styles.th}>Teacher</th>
          <th style={styles.th}>Email</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Joined</th>
          <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
        </tr></thead>
        <tbody>
          {teachers.map((t: any) => (
            <tr key={t.id} onMouseEnter={() => setHoveredRow(t.id)} onMouseLeave={() => setHoveredRow(null)} style={hoveredRow === t.id ? styles.trHover : {}}>
              <td style={{ ...styles.td, color: H.textPrimary, fontWeight: 600 }}>{t.full_name}</td>
              <td style={{ ...styles.td, color: H.textSec, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.email}>{t.email}</td>
              <td style={styles.td}>
                {t.must_change_password ? (
                  <Badge variant="pending">Password Reset Required</Badge>
                ) : t.is_active ? (
                  <Badge variant="active">Active</Badge>
                ) : (
                  <Badge variant="inactive">Inactive</Badge>
                )}
              </td>
              <td style={{ ...styles.td, fontVariantNumeric: 'tabular-nums' }}>{new Date(t.created_at).toLocaleDateString('en-GB')}</td>
              <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <TeacherActions teacherId={t.id} isActive={t.is_active} teacherName={t.full_name} onDone={onActionDone} />
                  <Link href={`/admin/teachers/${t.id}`} title="View Details" style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px', minHeight: '36px' }}><ChevronRight size={16}/></Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PendingTable = ({ pending, deletePending, deletingId }: { pending: any[]; deletePending: (id: string, name: string) => Promise<void> | void; deletingId: string | null }) => {
  const isMobile = useIsMobile();

  return (
    <div>
      {/* Section header strip */}
      <div style={{ padding: '12px 24px', borderTop: `1px solid ${H.border}`, backgroundColor: '#FAF9F6', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={15} style={{ color: '#B45309' }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Sign-ups</span>
        <span style={{ fontSize: '12px', color: H.textMuted, marginLeft: '4px' }}>({pending.length})</span>
      </div>

      {isMobile ? (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pending.map((u: any) => (
            <div key={u.id} style={{
              backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '12px', padding: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
            }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary, margin: 0 }}>{u.full_name}</p>
                <p style={{ fontSize: '12px', color: H.textSec, margin: '2px 0 0', wordBreak: 'break-all' }}>{u.email}</p>
                <p style={{ fontSize: '11px', color: H.textMuted, margin: '4px 0 0' }}>Added {new Date(u.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <button onClick={() => deletePending(u.id, u.full_name)} disabled={deletingId === u.id} style={{
                background: H.dangerLight, border: `1px solid ${H.danger}30`, borderRadius: '8px', color: H.danger,
                padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700
              }}>
                {deletingId === u.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ width: '100%', overflowX: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead><tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Added On</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {pending.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ ...styles.td, fontWeight: 600, color: H.textPrimary }}>{u.full_name}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={{ ...styles.td, fontVariantNumeric: 'tabular-nums' }}>{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button onClick={() => deletePending(u.id, u.full_name)} disabled={deletingId === u.id} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: H.danger, padding: '6px 8px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {deletingId === u.id ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Pagination = ({ page, totalPages, setPage, totalCount }: { page: number; totalPages: number; setPage: (fn: (p: number) => number) => void; totalCount: number }) => {
    if (totalPages <= 1) return null;
    return (
        <div style={styles.paginationContainer}>
            <span style={styles.paginationText}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} teachers</span>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setPage((p: number) => Math.max(0, p - 1))} disabled={page === 0} style={{ ...styles.button, ...styles.buttonSecondary, opacity: page === 0 ? 0.5 : 1 }}>Prev</button>
                <button onClick={() => setPage((p: number) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...styles.button, ...styles.buttonSecondary, opacity: page >= totalPages - 1 ? 0.5 : 1 }}>Next</button>
            </div>
        </div>
    )
};


// MAIN PAGE COMPONENT ========================================================
export default function TeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, pending: 0 })
  const [addSuccess, setAddSuccess] = useState(false)
  const [deletingPending, setDeletingPending] = useState<string | null>(null)
  const [modal, setModal] = useState<ConfirmModalState | null>(null)
  const supabase = createClient();
  const { showToast } = useToast();

  const fetchTeachers = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'teacher').order('full_name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (statusFilter === 'active') query = query.eq('is_active', true)
      if (statusFilter === 'inactive') query = query.eq('is_active', false)
      if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`)
      const { data, count } = await query;
      setTeachers(data || []);
      setTotalCount(count || 0);

      const [{ count: total }, { count: active }, { count: inactive }, { data: pendingData }, { data: profileEmails }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', false),
        supabase.from('allowed_users').select('*').eq('is_registered', false).order('created_at', { ascending: false }),
        supabase.from('profiles').select('email').eq('role', 'teacher'),
      ]);

      const registeredEmails = new Set((profileEmails || []).map(p => p.email?.toLowerCase()));
      const actualPending = (pendingData || []).filter(u => !registeredEmails.has(u.email?.toLowerCase()));

      setStats({ total: total || 0, active: active || 0, inactive: inactive || 0, pending: actualPending.length });
      setPending(actualPending);
    } finally { setLoading(false) }
  }, [search, statusFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => fetchTeachers(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchTeachers, search]);
  
  useEffect(() => { setPage(0) }, [search, statusFilter]);

  const handleAddSuccess = () => {
    setAddSuccess(true);
    showToast('Teacher account created successfully!', 'success');
    fetchTeachers();
    setTimeout(() => setAddSuccess(false), 5000);
  };
  
  const handleExportCSV = () => {
    const ok = exportToCSV(
      'teachers_list',
      [
        { label: 'Full Name', key: 'full_name' },
        { label: 'Email', key: 'email' },
        { label: 'Status', key: 'is_active' },
        { label: 'Joined Date', key: 'created_at' },
      ],
      teachers
    )
    if (ok) {
      showToast(`Exported ${teachers.length} teacher records to CSV`, 'success')
    } else {
      showToast('No teacher records available to export', 'warning')
    }
  }

  const deletePending = (id: string, name: string) => {
    setModal({
      title: 'Delete Pre-Registration?',
      message: `This will permanently delete the pre-registration for "${name}". They will not be able to sign up. Are you sure?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModal(null);
        setDeletingPending(id);
        await supabase.from('allowed_users').delete().eq('id', id);
        setDeletingPending(null);
        showToast(`Deleted pre-registration for ${name}`, 'info');
        fetchTeachers();
      }
    });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', paddingBottom: '80px', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
        <PageHeader stats={stats} onRefresh={fetchTeachers} onAddSuccess={handleAddSuccess} />
        
        {addSuccess && (
          <div style={{ padding: '12px 24px', background: H.successLight, borderBottom: `1px solid ${H.successGreen}`, display: 'flex', alignItems: 'center', gap: '12px', color: '#065F46', fontWeight: 600, fontSize: '13px' }}>
            <CheckCircle2 size={18}/> Teacher account created. The teacher can now sign in using their temporary password.
          </div>
        )}

        <FilterControls search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onExport={handleExportCSV} />

        <div>
          {loading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : (
            <Fragment>
              <TeachersTable teachers={teachers} onActionDone={fetchTeachers} />
              <Pagination page={page} totalPages={totalPages} setPage={setPage} totalCount={totalCount} />
            </Fragment>
          )}
        </div>

        {pending.length > 0 && (
          <PendingTable pending={pending} deletePending={deletePending} deletingId={deletingPending} />
        )}
      </div>

      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
