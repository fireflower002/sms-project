'use client'

import { useEffect, useState } from 'react'
import {
  Package, AlertTriangle, CheckCircle2, ShieldAlert,
  Clock, MapPin, Tag, Wrench, XCircle, Info, Laptop, FlaskConical, Trophy, BookOpen, Music, TestTube
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { H } from '@/lib/honey'
import { ItemDetailSkeleton } from '@/components/ui/Skeleton'

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

export default function PublicItemDetailClient({ token, initialData }: { token: string; initialData?: any }) {
  const [item, setItem] = useState<any | null>(initialData?.item || null)
  const [assigneeRole, setAssigneeRole] = useState<string | null>(initialData?.assigneeRole || null)
  const [loading, setLoading] = useState(!initialData)
  const [errorState, setErrorState] = useState<'not_found' | 'inactive' | 'permission_error' | null>(initialData?.errorState || null)
  const [errorDetail, setErrorDetail] = useState<string>(initialData?.errorDetail || '')
  const supabase = createClient()

  useEffect(() => {
    if (initialData) return

    const fetchPublicItem = async () => {
      setLoading(true)
      setErrorState(null)
      setErrorDetail('')
      const cleanToken = (token || '').trim()

      try {
        const fields = 'id, name, description, category, condition, condition_notes, quantity_total, quantity_available, location, assigned_role, assigned_at, public_token, barcode, is_active'
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanToken)

        let targetData: any = null
        let lastError: any = null

        if (isUuid) {
          const { data, error } = await supabase
            .from('public_inventory_verification')
            .select(fields)
            .eq('public_token', cleanToken)
            .maybeSingle()

          if (data) targetData = data
          if (error && error.code !== 'PGRST116') lastError = error
        }

        if (!targetData && isUuid) {
          const { data, error } = await supabase
            .from('public_inventory_verification')
            .select(fields)
            .eq('id', cleanToken)
            .maybeSingle()

          if (data) targetData = data
          if (error && error.code !== 'PGRST116') lastError = error
        }

        if (!targetData) {
          const { data, error } = await supabase
            .from('public_inventory_verification')
            .select(fields)
            .eq('barcode', cleanToken)
            .maybeSingle()

          if (data) targetData = data
          if (error && error.code !== 'PGRST116') lastError = error
        }

        if (!targetData) {
          if (lastError) {
            setErrorState('permission_error')
            setErrorDetail(lastError.message || 'Database permissions or column configuration issue.')
          } else {
            setErrorState('not_found')
          }
          setLoading(false)
          return
        }

        if (!targetData.is_active) {
          setErrorState('inactive')
          setLoading(false)
          return
        }

        setItem(targetData)

        if (targetData.assigned_role) {
          const roleNormalized = targetData.assigned_role.toLowerCase()
          if (roleNormalized === 'admin') setAssigneeRole('Administrator')
          else if (roleNormalized === 'teacher') setAssigneeRole('Teacher / Staff')
          else if (roleNormalized === 'student') setAssigneeRole('Student')
          else setAssigneeRole(targetData.assigned_role)
        }
      } catch (err: any) {
        console.error('Exception fetching public item verification data:', err)
        setErrorState('permission_error')
        setErrorDetail(err?.message || 'An unexpected error occurred while loading item metadata.')
      } finally {
        setLoading(false)
      }
    }

    fetchPublicItem()
  }, [token, initialData, supabase])

  if (loading) {
    return <ItemDetailSkeleton />
  }

  if (errorState || !item) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: H.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: H.font }}>
        <div style={{ maxWidth: '440px', width: '100%', backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '20px', padding: '36px 28px', textAlign: 'center', boxShadow: H.shadows.card }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: H.dangerLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <ShieldAlert size={32} color={H.danger} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: '0 0 10px' }}>
            {errorState === 'inactive' ? 'Item Deactivated' : errorState === 'permission_error' ? 'System Verification Error' : 'Invalid Verification Link'}
          </h2>
          <p style={{ fontSize: '14px', color: H.textSec, lineHeight: 1.6, margin: '0 0 24px' }}>
            {errorState === 'inactive'
              ? 'This item has been decommissioned or removed from active school verification records.'
              : errorState === 'permission_error'
              ? (errorDetail || 'Public verification endpoint is currently restricted.')
              : 'The scanned verification code or token does not match any registered inventory asset.'}
          </p>
          <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: H.bg, border: `1px solid ${H.border}`, fontSize: '12px', color: H.textMuted, wordBreak: 'break-all' }}>
            Token ID: <code style={{ fontWeight: 700, color: H.textPrimary }}>{token}</code>
          </div>
        </div>
      </div>
    )
  }

  const condCfg = CONDITION_CONFIG[item.condition?.toLowerCase()] || CONDITION_CONFIG.good
  const CondIcon = condCfg.icon

  return (
    <div style={{ minHeight: '100vh', backgroundColor: H.bg, fontFamily: H.font, color: H.textPrimary, padding: '24px 16px 60px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Top Header Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: H.shadows.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', backgroundColor: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color={H.mintGreen} />
            </div>
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: H.textPrimary }}>Official Item Verification</h1>
              <p style={{ fontSize: '11px', color: H.textMuted, margin: '2px 0 0' }}>School Inventory System</p>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: H.mintGreen, backgroundColor: H.mintLight, padding: '4px 10px', borderRadius: '20px', border: `1px solid ${H.mintLight}` }}>
            ✓ Verified Authentic
          </span>
        </div>

        {/* Main Item Metadata Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '20px', padding: '24px', boxShadow: H.shadows.card, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', backgroundColor: H.mintLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {getCategoryIcon(item.category)}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: H.mintGreen }}>
                {item.category || 'General Equipment'}
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: H.textPrimary, margin: '4px 0 6px', lineHeight: 1.3 }}>
                {item.name}
              </h2>
              {item.barcode && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontFamily: 'monospace', backgroundColor: H.bg, border: `1px solid ${H.border}`, padding: '2px 8px', borderRadius: '6px', color: H.textSec }}>
                  <Tag size={12} /> {item.barcode}
                </div>
              )}
            </div>
          </div>

          {item.description && (
            <p style={{ fontSize: '14px', color: H.textSec, lineHeight: 1.6, margin: 0, padding: '12px 16px', borderRadius: '12px', backgroundColor: H.bg, border: `1px solid ${H.border}` }}>
              {item.description}
            </p>
          )}

          {/* Condition Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '14px', backgroundColor: condCfg.bg, border: `1px solid ${condCfg.bg}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CondIcon size={20} color={condCfg.color} />
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: condCfg.color, opacity: 0.8, textTransform: 'uppercase' }}>Current Condition</span>
                <p style={{ fontSize: '14px', fontWeight: 800, color: condCfg.color, margin: '2px 0 0' }}>{condCfg.label}</p>
              </div>
            </div>
          </div>

          {item.condition_notes && (
            <div style={{ fontSize: '13px', color: H.textSec, fontStyle: 'italic', padding: '10px 14px', borderRadius: '10px', backgroundColor: H.bg, borderLeft: `3px solid ${condCfg.color}` }}>
              "{item.condition_notes}"
            </div>
          )}

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: H.bg, border: `1px solid ${H.border}` }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} /> Storage Location
              </span>
              <p style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary, margin: '4px 0 0' }}>
                {item.location || 'Unassigned Lab / Room'}
              </p>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: H.bg, border: `1px solid ${H.border}` }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Package size={13} /> Available Quantity
              </span>
              <p style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary, margin: '4px 0 0' }}>
                {item.quantity_available ?? item.quantity_total ?? 1} / {item.quantity_total ?? 1} units
              </p>
            </div>
          </div>

          {/* Assigned Custody Footer */}
          {assigneeRole && (
            <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: H.bg, border: `1px solid ${H.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: H.textMuted, textTransform: 'uppercase' }}>Assigned Custody</span>
                <p style={{ fontSize: '13px', fontWeight: 700, color: H.textPrimary, margin: '2px 0 0' }}>{assigneeRole}</p>
              </div>
              {item.assigned_at && (
                <span style={{ fontSize: '11px', color: H.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> {new Date(item.assigned_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
