import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { H } from '@/lib/honey'

// ─── Shared surface styles ────────────────────────────────────────────────────
const cardBase: React.CSSProperties = {
  backgroundColor: H.surface,
  border: `1px solid ${H.border}`,
  borderRadius: '16px',
  boxShadow: H.cardShadow,
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant A — "Link stat card" (admin dashboard)
//   Vertical layout, left colour border, large value, optional footer, hover lift.
// ─────────────────────────────────────────────────────────────────────────────
interface LinkStatCardProps {
  variant: 'link'
  /** Destination href; the whole card is a Next.js Link */
  href: string
  label: string
  value: React.ReactNode
  /** Any Lucide icon component */
  icon: LucideIcon
  /** Accent colour: left border + icon tint */
  color: string
  /** Optional small text below the value */
  footer?: React.ReactNode
  /** Controlled hover state from the parent (for animation) */
  isHovered?: boolean
  onHover?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant B — "Icon stat card" (inventory, profile-requests, timetable/view)
//   Horizontal layout, icon in a tinted circle, value + label stacked right.
// ─────────────────────────────────────────────────────────────────────────────
interface IconStatCardProps {
  variant: 'icon'
  value: React.ReactNode
  label: string
  /** Any Lucide icon component */
  icon: LucideIcon
  /** Circle background colour */
  iconBg: string
  /** Icon colour */
  iconColor: string
  /** Extra styles forwarded to the wrapper */
  style?: React.CSSProperties
}

type StatCardProps = LinkStatCardProps | IconStatCardProps

/**
 * Unified stat-card component covering the two distinct patterns used across
 * the project.
 *
 * variant="link"  — admin dashboard: clickable, left border, hover lift
 *   <StatCard
 *     variant="link"
 *     href="/admin/teachers"
 *     label="Active Teachers"
 *     value={42}
 *     icon={Users}
 *     color={H.successGreen}
 *     footer="vs 40 last month"
 *     isHovered={hovered === 'teachers'}
 *     onHover={() => setHovered(hovered === 'teachers' ? null : 'teachers')}
 *   />
 *
 * variant="icon"  — inventory / profile-requests: horizontal, icon circle left
 *   <StatCard
 *     variant="icon"
 *     value={stats.total}
 *     label="Total Items"
 *     icon={Package}
 *     iconBg={H.mintLight}
 *     iconColor="#0E7490"
 *   />
 */
export default function StatCard(props: StatCardProps) {
  if (props.variant === 'link') {
    const { href, label, value, icon: Icon, color, footer, isHovered, onHover } = props
    return (
      <Link
        href={href}
        style={{
          ...cardBase,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          textDecoration: 'none',
          color: 'inherit',
          borderLeft: `4px solid ${color}`,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          transform: isHovered ? 'translateY(-4px)' : 'none',
        }}
        onMouseEnter={onHover}
        onMouseLeave={onHover}
      >
        {/* Header row with perfect center alignment */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: H.textSec, lineHeight: 1.2 }}>{label}</span>
          <Icon size={20} style={{ color, flexShrink: 0 }} />
        </div>
        {/* Value + footer */}
        <div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: H.textPrimary, lineHeight: 1.1 }}>
            {value}
          </div>
          {footer && (
            <div style={{ fontSize: '12px', color: H.textMuted, marginTop: '4px' }}>{footer}</div>
          )}
        </div>
      </Link>
    )
  }

  // variant === 'icon'
  const { value, label, icon: Icon, iconBg, iconColor, style } = props
  return (
    <div
      style={{
        ...cardBase,
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          backgroundColor: iconBg,
          color: iconColor,
        }}
      >
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: '28px', fontWeight: 800, color: H.textPrimary, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: H.textSec, marginTop: '2px' }}>
          {label}
        </div>
      </div>
    </div>
  )
}
