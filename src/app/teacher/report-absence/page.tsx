'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, AlertCircle, Calendar, Sun, Moon, Sparkles, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { todaySLT, generatePeriods } from '@/lib/utils'
import { H } from '@/lib/honey'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const styles: { [key: string]: React.CSSProperties } = {
  page: { backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 32px)', fontFamily: H.font },
  container: { maxWidth: '600px', margin: '0 auto' },
  pageHeader: { textAlign: 'center', marginBottom: '32px' },
  pageTitle: { fontSize: '24px', fontWeight: 800, color: H.textPrimary, margin: 0 },
  pageSubtitle: { fontSize: '14px', color: H.textSec, marginTop: '4px', margin: '4px 0 0' },
  card: { backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' },
  button: { border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', padding: '12px 24px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', minHeight: '44px' },
  buttonPrimary: { background: H.purple, color: '#FFFFFF' },
  label: { display: 'block', fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' },
}

const inputStyle = (isFocused: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 16px', borderRadius: '10px',
  border: `2px solid ${isFocused ? H.purple : H.border}`,
  background: H.bg, color: H.textPrimary, fontFamily: H.font,
  fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s ease', minHeight: '44px',
})

const ABSENCE_TYPES = [
  { value: 'full_day', label: 'Full Day', desc: 'Absent the entire day', icon: <Moon size={20} /> },
  { value: 'morning_block', label: 'Morning Block', desc: 'Absent in the morning only', icon: <Sun size={20} /> },
  { value: 'afternoon_block', label: 'Afternoon Block', desc: 'Absent in the afternoon only', icon: <Sun size={20} /> },
  { value: 'custom_periods', label: 'Specific Periods', desc: 'Choose which periods to miss', icon: <Sparkles size={20} /> },
]

export default function ReportAbsencePage() {
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [template, setTemplate] = useState<any>(null)
  const [alreadyExists, setAlreadyExists] = useState(false)
  const [form, setForm] = useState({ absence_date: todaySLT(), absence_type: 'full_day', reason: '', custom_periods: [] as number[] })
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/teacher/login'); return }

      const [{ data: tmpl }, { data: existing }] = await Promise.all([
        supabase.from('timetable_templates').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('absences').select('id').eq('teacher_id', user.id).eq('absence_date', todaySLT()).maybeSingle(),
      ])
      setTemplate(tmpl || null)
      setAlreadyExists(!!existing)
      setLoading(false)
    }
    load()
  }, [router, supabase])

  const periods = template ? generatePeriods(template.start_time, template.end_time, template.period_duration, template.breaks || []).filter((p: any) => !p.is_break) : []
  const togglePeriod = (n: number) => setForm(f => ({ ...f, custom_periods: f.custom_periods.includes(n) ? f.custom_periods.filter(x => x !== n) : [...f.custom_periods, n] }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setError('Not authenticated'); setSubmitting(false); return }
    if (alreadyExists) { setError('You already have an absence recorded for today.'); setSubmitting(false); return }

    const payload: any = { teacher_id: user.id, absence_date: form.absence_date, absence_type: form.absence_type, reason: form.reason || null }
    if (form.absence_type === 'custom_periods') payload.custom_periods = form.custom_periods

    const { error: err } = await supabase.from('absences').insert(payload)
    if (err) { setError(err.message) } else { setDone(true) }
    setSubmitting(false)
  }


  if (loading) return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: H.font }}>
      <LoadingSpinner size={32} color={H.skyBlue} />
    </div>
  )

  if (done) return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: H.font, padding: '24px' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, padding: '40px', textAlign: 'center', maxWidth: '480px', width: '100%' }}>
        <CheckCircle2 size={52} style={{ color: H.grass, margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: H.textPrimary, margin: '0 0 8px' }}>Absence Reported</h2>
        <p style={{ fontSize: '14px', color: H.textSec, margin: '0 0 24px' }}>The school administration has been notified. Cover will be arranged if necessary.</p>
        <Link href="/teacher" style={{ ...styles.button, ...styles.buttonPrimary }}>Back to Dashboard</Link>
      </div>
    </div>
  )

  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', fontFamily: H.font, boxSizing: 'border-box', paddingBottom: '48px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', boxShadow: H.cardShadow, overflow: 'hidden' }}>

          {/* Contiguous Header Bar */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: H.surface }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: H.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={20} style={{ color: H.purpleDark }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>Report an Absence</h1>
              <p style={{ fontSize: '13px', color: H.textSec, margin: '4px 0 0' }}>Notify administration of your absence</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {alreadyExists && <div style={{ padding: '14px 24px', background: H.accentLight, color: H.accentDark, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${H.accent}40` }}><AlertCircle size={16} />You already have an absence recorded for today.</div>}
            {error && <div style={{ padding: '14px 24px', background: H.dangerLight, color: H.danger, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', borderBottom: `1px solid ${H.danger}40` }}><AlertCircle size={16} />{error}</div>}

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={styles.label}><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Absence Date</label>
                <input type="date" value={form.absence_date} onChange={e => setForm(f => ({ ...f, absence_date: e.target.value }))} style={inputStyle(focusedField === 'date')} onFocus={() => setFocusedField('date')} onBlur={() => setFocusedField(null)} required />
              </div>

              <div>
                <label style={styles.label}>Absence Type</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ABSENCE_TYPES.map(t => (
                    <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', border: `2px solid ${form.absence_type === t.value ? H.purple : H.border}`, background: form.absence_type === t.value ? H.purpleLight : H.surface, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                      <input type="radio" name="type" value={t.value} checked={form.absence_type === t.value} onChange={() => setForm(f => ({ ...f, absence_type: t.value }))} style={{ display: 'none' }} />
                      <div style={{ color: form.absence_type === t.value ? H.purpleDark : H.textSec }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: form.absence_type === t.value ? H.purpleDark : H.textPrimary }}>{t.label}</div>
                        <div style={{ fontSize: '12px', color: form.absence_type === t.value ? H.purpleDark : H.textSec }}>{t.desc}</div>
                      </div>
                      {form.absence_type === t.value && <CheckCircle2 size={20} style={{ color: H.purple }} />}
                    </label>
                  ))}
                </div>
              </div>

              {form.absence_type === 'custom_periods' && periods.length > 0 && (
                <div>
                  <label style={styles.label}>Select Periods</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {periods.map((p: any) => (
                      <button key={p.period_number} type="button" onClick={() => togglePeriod(p.period_number)} style={{ ...styles.button, minHeight: '38px', padding: '8px 16px', background: form.custom_periods.includes(p.period_number) ? H.purpleLight : H.bg, color: form.custom_periods.includes(p.period_number) ? H.purpleDark : H.textPrimary, border: `1px solid ${form.custom_periods.includes(p.period_number) ? H.purple : H.border}` }}>P{p.period_number}</button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={styles.label}>Reason (Optional)</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Sick leave, family emergency..." rows={3} style={{ ...inputStyle(focusedField === 'reason'), resize: 'vertical', minHeight: '80px' }} onFocus={() => setFocusedField('reason')} onBlur={() => setFocusedField(null)} />
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${H.border}`, padding: '16px 24px', background: H.bg, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={submitting || alreadyExists} style={{ ...styles.button, ...styles.buttonPrimary, width: '100%', opacity: (submitting || alreadyExists) ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Submit Absence Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
