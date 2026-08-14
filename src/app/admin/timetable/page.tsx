'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock, Trash2, Loader2, Star, Eye, Coffee, Info, AlertTriangle, Calendar, Pencil, FileSpreadsheet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'
import { H } from '@/lib/honey'
import Badge from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

const styles: { [key: string]: React.CSSProperties } = {
  // Shell (matches all other admin pages)
  shell: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  // Buttons
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', minHeight: '38px', padding: '8px 16px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background-color 0.2s ease', textDecoration: 'none', boxSizing: 'border-box' },
  buttonPrimary: { background: H.purple, color: '#FFFFFF' },
  buttonSecondary: { background: '#F5F5F4', color: H.textSec, border: `1px solid ${H.border}` },
  buttonDanger: { background: H.dangerLight, color: H.danger, border: `1px solid ${'#FECACA'}` },
  // Template card (within the shell body)
  templateCard: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '14px', overflow: 'hidden' },
};

// SUB-COMPONENTS ==============================================================

const TemplateCard = ({ template, totalCount, onSetActive, onConfirmDelete, activating }: { template: any; totalCount: number; onSetActive: (id: string) => void; onConfirmDelete: (t: any) => void; activating: boolean }) => {
  const numPeriods = (() => {
    const t = template;
    if (!t.start_time || !t.end_time || !t.period_duration) return 0;
    const toMins = (s: string) => s.split(':').map(Number).reduce((h: number, m: number) => h * 60 + m);
    const breakMins = (t.breaks || []).reduce((acc: number, b: any) => acc + b.duration, 0);
    return Math.floor((toMins(t.end_time) - toMins(t.start_time) - breakMins) / t.period_duration);
  })();
  const breaks = template.breaks || [];

  return (
    <div style={styles.templateCard}>
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: H.textPrimary, margin: 0 }}>{template.name}</h2>
              {template.is_active ? (
                <Badge variant="category" icon={<Star size={12} />}>Active Schedule</Badge>
              ) : (
                <Badge variant="inactive">Draft / Inactive</Badge>
              )}
            </div>
            <p style={{ color: H.textSec, fontSize: '13px', margin: '4px 0 0' }}>
              Created: {new Date(template.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: H.textSec }}>
          <div><strong>Hours:</strong> {formatTime(template.start_time)} – {formatTime(template.end_time)}</div>
          <div><strong>Duration:</strong> {numPeriods} periods ({template.period_duration} min)</div>
          <div><strong>Breaks:</strong> {breaks.length} scheduled</div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${H.border}`, padding: '14px 24px', background: H.bg, display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
        <Link href={`/admin/timetable/${template.id}/build`} style={{ ...styles.button, ...styles.buttonPrimary }}>
          <Pencil size={15} /> Edit Schedule
        </Link>
        <Link href={`/admin/timetable/view/${template.id}`} style={{ ...styles.button, ...styles.buttonSecondary }}>
          <Eye size={15} /> View Schedule
        </Link>
        {!template.is_active && (
          <button onClick={() => onSetActive(template.id)} disabled={activating} style={{ ...styles.button, background: H.purpleLight, color: H.purpleDark }}>
            {activating ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Star size={15} />} Set Active
          </button>
        )}
        <button
          onClick={() => onConfirmDelete(template)}
          disabled={totalCount <= 1}
          title={totalCount <= 1 ? "Cannot delete the sole timetable template" : "Delete template"}
          style={{ ...styles.button, ...styles.buttonDanger, opacity: totalCount <= 1 ? 0.4 : 1, cursor: totalCount <= 1 ? 'not-allowed' : 'pointer' }}
        >
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </div>
  );
};

const DeleteModal = ({ template, totalCount, onCancel, onDelete, deleting, error }: { template: any; totalCount: number; onCancel: () => void; onDelete: (t: any) => void; deleting: boolean; error: string | null }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(28,25,23,0.6)', backdropFilter: 'blur(4px)' }} onClick={onCancel} />
    <div style={{ position: 'relative', width: '100%', maxWidth: '480px', borderRadius: '16px', backgroundColor: H.surface, border: `1px solid ${H.border}`, boxShadow: H.cardShadow, padding: '28px 32px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: H.textPrimary, marginTop: 0 }}>Delete Template?</h2>
      <p style={{ color: H.textSec, fontSize: '14px' }}>
        This will permanently delete <strong>"{template.name}"</strong> and all its schedule assignments. This cannot be undone.
      </p>
      {template.is_active && (
        <div style={{ background: H.accentLight, border: `1px solid ${H.accent}`, color: H.accentDark, borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
          <AlertTriangle size={18} />This is the Active Master Schedule. Deleting it will reassign linked absences and set the newest remaining template as Active.
        </div>
      )}
      {error && <p style={{ color: H.danger, fontSize: '13px' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
        <button onClick={onCancel} style={{ ...styles.button, ...styles.buttonSecondary }}>Cancel</button>
        <button onClick={() => onDelete(template)} disabled={deleting || totalCount <= 1} style={{ ...styles.button, background: H.danger, color: '#FFFFFF', opacity: (deleting || totalCount <= 1) ? 0.7 : 1 }}>
          {deleting ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : 'Yes, Delete Template'}
        </button>
      </div>
    </div>
  </div>
);


// MAIN PAGE COMPONENT ========================================================
export default function TimetablePage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const supabase = createClient();

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('timetable_templates').select('*').order('created_at', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }, []);

  useEffect(() => { fetchTemplates() }, [fetchTemplates]);

  const handleSetActive = async (id: string) => {
    setActivating(id);
    try {
      await supabase.from('timetable_templates').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('timetable_templates').update({ is_active: true }).eq('id', id);
      await fetchTemplates();
    } catch (e) {
      console.error(e);
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async (template: any) => {
    if (templates.length <= 1) {
      setDeleteError('Cannot delete the sole timetable template. At least one template must exist to maintain school scheduling and absence history.');
      return;
    }
    setDeleting(template.id);
    setDeleteError(null);
    try {
      const { error: err1 } = await supabase.from('schedule_assignments').delete().eq('template_id', template.id);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('timetable_templates').delete().eq('id', template.id);
      if (err2) throw err2;
      setConfirmDelete(null);
      fetchTemplates();
    } catch (e: any) {
      setDeleteError(`Error deleting template: ${e.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box' }}>
      <div style={styles.shell}>

        {/* Contiguous Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Timetable Templates</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0', fontVariantNumeric: 'tabular-nums' }}>
                Manage reusable schedule structures for the school
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link href="/admin/classes" style={{ ...styles.button, ...styles.buttonSecondary }}>Manage Classes</Link>
            <Link href="/admin/timetable/import" style={{ ...styles.button, ...styles.buttonSecondary, color: H.purple, borderColor: H.purple }}>
              <FileSpreadsheet size={16} /> Import Yearly Timetable
            </Link>
            <Link href="/admin/timetable/new" style={{ ...styles.button, ...styles.buttonPrimary }}>+ New Template</Link>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
              <LoadingSpinner size={32} color={H.skyBlue} />
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <EmptyState
                title="No Timetable Templates Found"
                description="Get started by creating your first school schedule template."
                action={<Link href="/admin/timetable/new" style={{ ...styles.button, ...styles.buttonPrimary }}>+ New Template</Link>}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {templates.map(t => (
                <TemplateCard key={t.id} template={t} totalCount={templates.length} onSetActive={handleSetActive} onConfirmDelete={setConfirmDelete} activating={activating === t.id} />
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <DeleteModal
          template={confirmDelete}
          totalCount={templates.length}
          onCancel={() => { setConfirmDelete(null); setDeleteError(null); }}
          onDelete={handleDelete}
          deleting={deleting === confirmDelete.id}
          error={deleteError}
        />
      )}
    </div>
  )
}
