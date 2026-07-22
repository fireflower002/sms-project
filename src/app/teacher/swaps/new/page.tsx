'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft, ArrowRightLeft, CheckCircle2, AlertCircle, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todaySLT, dateToDayOfWeek } from '@/lib/utils'
import { H } from '@/lib/honey'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: '32px', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  container: { maxWidth: '640px', margin: '0 auto' },
  pageHeader: { marginBottom: '24px' },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: H.textSec, textDecoration: 'none', fontSize: '14px', fontWeight: 600, marginBottom: '12px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '14px', padding: '12px 24px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' },
  buttonPrimary: { background: H.softPink, color: '#FFFFFF' },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '8px' },
};

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: `2px solid ${isFocused ? H.softPink : H.border}`,
  background: H.bg, color: H.textPrimary,
  fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease',
});

export default function NewSwapPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const [date, setDate] = useState(todaySLT());
  const [mySchedule, setMySchedule] = useState<any[]>([]);
  const [selectedMySlot, setSelectedMySlot] = useState<any>(null);

  const [otherTeachers, setOtherTeachers] = useState<any[]>([]);
  const [targetTeacherId, setTargetTeacherId] = useState('');
  const [targetSchedule, setTargetSchedule] = useState<any[]>([]);
  const [selectedTargetSlot, setSelectedTargetSlot] = useState<any>(null);

  const [note, setNote] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  // Load user & teacher list on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/teacher/login'); return; }

      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name, subjects')
        .eq('role', 'teacher')
        .neq('id', session.user.id)
        .order('full_name');

      setOtherTeachers(teachers || []);
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  // Fetch my schedule & target teacher schedule whenever date or targetTeacherId changes
  useEffect(() => {
    const fetchSchedules = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const dayOfWeek = dateToDayOfWeek(date);

      const [myRes, targetRes] = await Promise.all([
        supabase
          .from('schedule_assignments')
          .select('*, class:classes(id, name, grade_level)')
          .eq('teacher_id', session.user.id)
          .eq('day_of_week', dayOfWeek)
          .order('period_number'),
        targetTeacherId
          ? supabase
              .from('schedule_assignments')
              .select('*, class:classes(id, name, grade_level)')
              .eq('teacher_id', targetTeacherId)
              .eq('day_of_week', dayOfWeek)
              .order('period_number')
          : Promise.resolve({ data: [] }),
      ]);

      setMySchedule(myRes.data || []);
      setSelectedMySlot(null);
      setTargetSchedule(targetRes.data || []);
      setSelectedTargetSlot(null);
    };
    fetchSchedules();
  }, [date, targetTeacherId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedMySlot) {
      setError('Please select one of your periods to swap.');
      return;
    }
    if (!targetTeacherId) {
      setError('Please select a teacher to swap with.');
      return;
    }
    if (!selectedTargetSlot) {
      setError("Please select the target teacher's period to swap into.");
      return;
    }

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setError('Not authenticated');
      setSubmitting(false);
      return;
    }

    const payload = {
      requester_id: session.user.id,
      target_teacher_id: targetTeacherId,
      swap_date: date,
      requester_period: selectedMySlot.period_number,
      requester_class_id: selectedMySlot.class_id,
      target_period: selectedTargetSlot.period_number,
      target_class_id: selectedTargetSlot.class_id,
      note: note.trim() || null,
      status: 'pending',
    };

    const { error: err } = await supabase.from('swap_requests').insert(payload);
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: H.softPink, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ ...styles.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...styles.card, padding: '40px', textAlign: 'center', maxWidth: '480px' }}>
          <CheckCircle2 size={48} style={{ color: H.successGreen, margin: '0 auto 16px' }} />
          <h2 style={{ ...styles.pageTitle, fontSize: '20px' }}>Swap Request Sent!</h2>
          <p style={{ ...styles.pageSubtitle, justifyContent: 'center' }}>
            The selected teacher will be notified to review and accept your swap request.
          </p>
          <Link href="/teacher/swaps" style={{ ...styles.button, ...styles.buttonPrimary, marginTop: '24px' }}>
            View My Swaps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '48px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

          {/* Contiguous Header Bar */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', backgroundColor: H.surface }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FDE8D8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRightLeft size={20} style={{ color: '#C2410C' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Create Swap Request</h1>
                <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>Request a period exchange with another teacher</p>
              </div>
            </div>
            <Link href="/teacher/swaps" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: H.textSec, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              <ArrowLeft size={14} /> Back to Swaps
            </Link>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ padding: '14px 24px', background: H.dangerLight, color: H.danger, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${H.danger}40` }}>
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Step 1: Swap Date */}
              <div>
                <label style={styles.label}>
                  <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 1. Swap Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={inputStyle(focusedField === 'date')}
                  onFocus={() => setFocusedField('date')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
              </div>

              {/* Step 2: Select My Period */}
              <div>
                <label style={styles.label}>2. Select Your Period To Give Up</label>
                {mySchedule.length === 0 ? (
                  <p style={{ color: H.textMuted, fontSize: '13px', margin: 0 }}>
                    You have no teaching periods assigned on this day.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {mySchedule.map(slot => {
                      const isSelected = selectedMySlot?.id === slot.id;
                      return (
                        <div
                          key={slot.id}
                          onClick={() => setSelectedMySlot(slot)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: `2px solid ${isSelected ? H.softPink : H.border}`,
                            background: isSelected ? H.softPinkLight : H.bg,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#831843' : H.textPrimary }}>
                            Period {slot.period_number}: {slot.subject}
                          </div>
                          <div style={{ fontSize: '12px', color: isSelected ? '#831843' : H.textSec }}>
                            {slot.class?.name || 'Class'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Select Teacher */}
              <div>
                <label style={styles.label}>3. Select Teacher To Swap With</label>
                <select
                  value={targetTeacherId}
                  onChange={e => setTargetTeacherId(e.target.value)}
                  style={inputStyle(focusedField === 'teacher')}
                  onFocus={() => setFocusedField('teacher')}
                  onBlur={() => setFocusedField(null)}
                  required
                >
                  <option value="">-- Choose a teacher --</option>
                  {otherTeachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.subjects?.length ? `(${t.subjects.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Select Target Teacher's Period */}
              {targetTeacherId && (
                <div>
                  <label style={styles.label}>4. Select Their Period You Want To Take</label>
                  {targetSchedule.length === 0 ? (
                    <p style={{ color: H.textMuted, fontSize: '13px', margin: 0 }}>
                      This teacher has no teaching periods assigned on this day.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      {targetSchedule.map(slot => {
                        const isSelected = selectedTargetSlot?.id === slot.id;
                        return (
                          <div
                            key={slot.id}
                            onClick={() => setSelectedTargetSlot(slot)}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '10px',
                              border: `2px solid ${isSelected ? H.softPink : H.border}`,
                              background: isSelected ? H.softPinkLight : H.bg,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '14px', color: isSelected ? '#831843' : H.textPrimary }}>
                              Period {slot.period_number}: {slot.subject}
                            </div>
                            <div style={{ fontSize: '12px', color: isSelected ? '#831843' : H.textSec }}>
                              {slot.class?.name || 'Class'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Optional Note */}
              <div>
                <label style={styles.label}>Note (Optional)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Reason for swap request..."
                  rows={3}
                  style={{ ...inputStyle(focusedField === 'note'), resize: 'vertical' }}
                  onFocus={() => setFocusedField('note')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 24px', background: H.bg, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting || !selectedMySlot || !selectedTargetSlot}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  width: '100%',
                  opacity: submitting || !selectedMySlot || !selectedTargetSlot ? 0.6 : 1,
                }}
              >
                {submitting ? (
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    <ArrowRightLeft size={16} /> Send Swap Request
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
