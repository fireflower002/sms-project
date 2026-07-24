'use client'

import { useEffect, useState, use } from 'react'
import {
  Package, AlertTriangle, CheckCircle2, ShieldAlert,
  Clock, MapPin, Tag, Wrench, XCircle, Info, Laptop, FlaskConical, Trophy, BookOpen, Music, TestTube
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'Electronics': return <Laptop size={28} color={H.mintGreen} />
    case 'Lab Equipment': return <FlaskConical size={28} color={H.mintGreen} />
    case 'Sports Equipment': return <Trophy size={28} color={H.mintGreen} />
    case 'Books & Stationery': return <BookOpen size={28} color={H.mintGreen} />
    case 'Musical Instruments': return <Music size={28} color={H.mintGreen} />
    case 'Chemicals': return <TestTube size={28} color={H.mintGreen} />
    case 'Safety Equipment': return <ShieldAlert size={28} color={H.mintGreen} />
    default: return <Package size={28} color={H.mintGreen} />
  }
}

const CONDITION_CONFIG: Record<string, { label: string; bg: string; color: string; icon: any }> = {
  new: { label: 'New', bg: '#D1FAE5', color: '#065F46', icon: CheckCircle2 },
  good: { label: 'Good Condition', bg: '#DCFCE7', color: '#166534', icon: CheckCircle2 },
  fair: { label: 'Fair Condition', bg: '#FEF3C7', color: '#92400E', icon: Info },
  poor: { label: 'Poor Condition', bg: '#FFEDD5', color: '#9A3412', icon: AlertTriangle },
  damaged: { label: 'Damaged', bg: '#FEE2E2', color: '#991B1B', icon: XCircle },
  under_repair: { label: 'Under Repair', bg: '#FEF3C7', color: '#B45309', icon: Wrench },
  lost: { label: 'Lost / Missing', bg: '#F3F4F6', color: '#4B5563', icon: AlertTriangle },
}

export default function PublicItemDetailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [item, setItem] = useState<any | null>(null)
  const [assigneeRole, setAssigneeRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchPublicItem = async () => {
      setLoading(true)
      try {
        // Query by public_token first, fallback to id
        let query = supabase
          .from('inventory')
          .select('id, name, description, category, condition, condition_notes, notes, quantity_total, quantity_available, location, assigned_to, assigned_at, public_token, barcode, is_active')
          .eq('is_active', true)

        let { data, error } = await query.eq('public_token', token).maybeSingle()

        if (!data) {
          const fallback = await supabase
            .from('inventory')
            .select('id, name, description, category, condition, condition_notes, notes, quantity_total, quantity_available, location, assigned_to, assigned_at, public_token, barcode, is_active')
            .eq('is_active', true)
            .eq('id', token)
            .maybeSingle()
          data = fallback.data
        }

        if (!data) {
          setNotFound(true)
          return
        }

        setItem(data)

        // Anonymized assignment role lookup (never expose personal names)
        if (data.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.assigned_to)
            .maybeSingle()

          if (profile?.role) {
            const roleFormatted = profile.role === 'teacher'
              ? 'Assigned to a Teacher'
              : `Assigned to ${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} Staff`
            setAssigneeRole(roleFormatted)
          } else {
            setAssigneeRole('Assigned to Staff Member')
          }
        }
      } catch (err) {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicItem()
  }, [token, supabase])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: H.bg, fontFamily: H.font, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: H.textSec }}>
          <Package size={40} style={{ animation: 'pulse 1.5s infinite', color: H.mintGreen }} />
          <p style={{ marginTop: 12, fontWeight: 600 }}>Loading item verification details…</p>
        </div>
      </div>
    )
  }

  if (notFound || !item) {
    return (
      <div style={{ minHeight: '100vh', background: H.bg, fontFamily: H.font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: H.surface, border: `1px solid ${H.border}`, borderRadius: 20, padding: 32, maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <ShieldAlert size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: H.textPrimary, margin: '0 0 8px 0' }}>Item Not Found</h2>
          <p style={{ fontSize: 14, color: H.textSec, margin: 0, lineHeight: 1.5 }}>
            The scanned QR code token is invalid, expired, or the inventory record is no longer active.
          </p>
        </div>
      </div>
    )
  }

  const cond = CONDITION_CONFIG[item.condition?.toLowerCase()] || CONDITION_CONFIG.good
  const CondIcon = cond.icon

  return (
    <div style={{ minHeight: '100vh', background: H.bg, fontFamily: H.font, color: H.textPrimary, padding: '24px 16px 60px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Public Header */}
        <header style={{ background: H.surface, border: `1px solid ${H.border}`, borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color={H.mintGreen} />
            </div>
            <div>
              <h1 style={{ fontSize: 15, fontWeight: 800, color: H.textPrimary, margin: 0 }}>School Inventory Verification</h1>
              <p style={{ fontSize: 11, color: H.textSec, margin: 0 }}>Public Scan Item Status</p>
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: H.mintGreen, background: 'rgba(6,182,212,0.08)', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(6,182,212,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verified
          </span>
        </header>

        {/* Main Item Card */}
        <div style={{ background: H.surface, border: `1px solid ${H.border}`, borderRadius: 20, padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {getCategoryIcon(item.category)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: H.textPrimary, margin: 0, lineHeight: 1.2 }}>{item.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: H.textSec, background: H.bg, padding: '3px 8px', borderRadius: 6, border: `1px solid ${H.border}` }}>
                  {item.category}
                </span>
                {item.barcode && (
                  <span style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: H.textMuted }}>
                    #{item.barcode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Condition Status Strip */}
          <div style={{ background: cond.bg, border: `1px solid ${cond.color}22`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <CondIcon size={22} color={cond.color} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: cond.color, opacity: 0.8 }}>
                Condition Status
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: cond.color, marginTop: 2 }}>
                {cond.label}
              </div>
            </div>
          </div>

          {/* Quantities Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: H.bg, padding: 14, borderRadius: 14, border: `1px solid ${H.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Available</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: item.quantity_available > 0 ? H.textPrimary : H.danger, fontVariantNumeric: 'tabular-nums' }}>
                {item.quantity_available}
              </div>
            </div>
            <div style={{ background: H.bg, padding: 14, borderRadius: 14, border: `1px solid ${H.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total In Stock</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: H.textSec, fontVariantNumeric: 'tabular-nums' }}>
                {item.quantity_total}
              </div>
            </div>
          </div>

          {/* Location & Assignment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: H.bg, padding: 16, borderRadius: 14, border: `1px solid ${H.border}` }}>
            {item.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={16} color={H.textMuted} />
                <span style={{ fontSize: 13, color: H.textSec }}>
                  Storage Location: <strong style={{ color: H.textPrimary }}>{item.location}</strong>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tag size={16} color={H.textMuted} />
              <span style={{ fontSize: 13, color: H.textSec }}>
                Assignment: <strong style={{ color: H.textPrimary }}>{assigneeRole || 'Available (Unassigned)'}</strong>
                {item.assigned_at && (
                  <span style={{ fontSize: 11, color: H.textMuted, marginLeft: 6 }}>
                    since {new Date(item.assigned_at).toLocaleDateString()}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Description & Condition Notes */}
          {(item.description || item.condition_notes || item.notes) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {item.description && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Item Description
                  </div>
                  <div style={{ fontSize: 13, color: H.textSec, lineHeight: 1.5 }}>
                    {item.description}
                  </div>
                </div>
              )}

              {(item.condition_notes || item.notes) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: H.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Condition / Maintenance Notes
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 14px', borderRadius: 10, color: '#92400E' }}>
                    {item.condition_notes || item.notes}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Read-Only Notice */}
        <footer style={{ textAlign: 'center', fontSize: 11, color: H.textMuted, padding: '0 8px' }}>
          Official School Inventory System • Scan verification link
        </footer>

      </div>
    </div>
  )
}
