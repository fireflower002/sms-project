'use client'
import { useEffect, useState, useCallback, Fragment } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, Pin, Trash2, Eye, Megaphone, MessageSquare, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatSLT } from '@/lib/utils'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { ConfirmModalState } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 4vw, 32px)', boxSizing: 'border-box' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0 0' },
  actionsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', minHeight: '44px', padding: '10px 18px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: H.skyBlue, color: '#FFFFFF' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
  mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' },
  // Badges
  badge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize' },
};

const PRIORITY_COLORS = {
  high: '#DC2626',
  medium: '#F59E0B',
  low: '#A8A29E'
};

// SUB-COMPONENTS ==============================================================
const AnnouncementCard = ({ item, totalTeachers, onTogglePin, onDelete, deleting }: { item: any; totalTeachers: number; onTogglePin: (id: string, pinned: boolean) => void; onDelete: (id: string, title: string) => void; deleting: boolean }) => {
  const readCount = item.reads?.[0]?.count || 0;
  const pct = totalTeachers > 0 ? Math.round((readCount / totalTeachers) * 100) : 0;
  const priorityColor = (PRIORITY_COLORS as any)[item.priority] || H.textMuted;
  
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${priorityColor}` }}>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {item.is_pinned && <Badge variant="pending">Pinned</Badge>}
          <Badge variant="category">{item.category}</Badge>
          <span style={{ fontSize: '12px', color: H.textMuted, marginLeft: 'auto' }}>{formatSLT(item.created_at, 'dd MMM, h:mm a')}</span>
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: H.textPrimary, margin: '0 0 8px' }}>{item.title}</h3>
        <p style={{ fontSize: '14px', color: H.textSec, lineHeight: 1.6, margin: '0 0 16px' }}>{item.body}</p>
        <div style={{ fontSize: '12px', color: H.textMuted }}>By {item.author?.full_name || 'Admin'}</div>
      </div>
      
      <div style={{ backgroundColor: H.bg, padding: '12px 20px', borderTop: `1px solid ${H.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{fontSize: '12px', fontWeight: 600, color: H.textSec}}><Eye size={14} style={{verticalAlign: 'bottom', marginRight: '6px'}}/>{readCount} of {totalTeachers} teachers have seen this.</span>
              <span style={{fontSize: '12px', fontWeight: 600, color: pct === 100 ? H.successGreen : H.textMuted}}>{pct}%</span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: H.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: H.successGreen, transition: 'width 0.5s ease' }}></div>
          </div>
      </div>

      <div style={{ borderTop: `1px solid ${H.border}`, padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onTogglePin(item.id, item.is_pinned)} title={item.is_pinned ? 'Unpin' : 'Pin'} style={{...styles.button, ...styles.buttonSecondary, padding: '8px', background: item.is_pinned ? H.accentLight : '#F5F5F4', color: item.is_pinned ? H.accentDark : H.textSec }}>
            <Pin size={16} />
          </button>
          <button onClick={() => onDelete(item.id, item.title)} disabled={deleting} style={{ ...styles.button, background: H.dangerLight, color: H.danger, padding: '8px' }}>
            {deleting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// MAIN PAGE COMPONENT ========================================================
export default function AnnouncementsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [totalTeachers, setTotalTeachers] = useState(0)
  const [filter, setFilter] = useState<'all' | 'pinned' | 'urgent'>('all')
  const [modal, setModal] = useState<ConfirmModalState | null>(null)
  const supabase = createClient();

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const [{ data }, { count: tc }] = await Promise.all([
      supabase.from('announcements').select('*, reads:announcement_reads(count), author:profiles!created_by(full_name)').eq('is_active', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('is_active', true),
    ]);
    setItems(data || []);
    setTotalTeachers(tc || 0);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchItems() }, [fetchItems]);

  const [search, setSearch] = useState('')
  const { showToast } = useToast()

  const togglePin = async (id: string, pinned: boolean) => {
    const { error } = await supabase.from('announcements').update({ is_pinned: !pinned }).eq('id', id);
    if (error) {
      showToast(`Error updating pin status: ${error.message}`, 'error')
      return;
    }
    showToast(pinned ? 'Announcement unpinned' : 'Announcement pinned', 'success')
    fetchItems();
  };

  const deleteItem = (id: string, title: string) => {
    setModal({
      title: 'Delete Announcement?',
      message: `Are you sure you want to delete the announcement "${title}"?`,
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModal(null);
        setDeleting(id);
        
        // Optimistic UI update
        setItems(prev => prev.filter(i => i.id !== id));

        try {
          const res = await fetch('/api/admin/announcements/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });

          const resData = await res.json();

          if (!res.ok || !resData.success) {
            showToast(`Could not delete announcement: ${resData.error || 'Delete failed'}`, 'error')
            fetchItems(); // Restore items on error
          } else {
            showToast(`Deleted notice "${title}"`, 'info')
          }
        } catch (err: any) {
          showToast(`Could not delete announcement: ${err.message || 'Network error'}`, 'error')
          fetchItems(); // Restore items on error
        } finally {
          setDeleting(null);
        }
      }
    });
  };

  const filteredItems = items.filter(i => {
    if (filter === 'pinned' && !i.is_pinned) return false;
    if (filter === 'urgent' && !(i.priority === 'high' || i.category === 'Urgent')) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return i.title?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>
        
        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.skyLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={20} style={{ color: H.skyDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>School Announcements</h1>
              <p style={{ fontSize: '13px', fontWeight: 400, color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Broadcast notices to staff and students • {totalTeachers} active teachers
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={fetchItems} style={{ ...styles.button, ...styles.buttonSecondary, padding: '8px 12px' }} title="Refresh">
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
            <Link href="/admin/announcements/new" style={{ ...styles.button, ...styles.buttonPrimary, borderRadius: '10px', minHeight: '38px', fontSize: '13px' }}>
              <Megaphone size={14} /> New Notice
            </Link>
          </div>
        </div>

        {/* Integrated Filter Toolbar with Search */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6' }}>
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: H.textMuted }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search announcements by title or content..."
              style={{
                width: '100%',
                padding: '8px 14px 8px 36px',
                borderRadius: '8px',
                border: `1px solid ${H.border}`,
                background: H.surface,
                color: H.textPrimary,
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'pinned', 'urgent'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                border: filter === f ? `1px solid ${H.border}` : 'none',
                background: filter === f ? H.surface : 'transparent',
                color: filter === f ? H.textPrimary : H.textSec, textTransform: 'capitalize'
              }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: H.textMuted }}>
              <LoadingSpinner size={28} />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState title="No Announcements" description="No notices found matching your criteria." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredItems.map(item => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  totalTeachers={totalTeachers}
                  onTogglePin={togglePin}
                  onDelete={deleteItem}
                  deleting={deleting === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        {...(modal ?? { title: '', message: '', onConfirm: () => {} })}
        onCancel={() => setModal(null)}
      />
    </div>
  )
}
