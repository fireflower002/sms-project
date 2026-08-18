import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { H } from '@/lib/honey'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'

// ─── Shared surface styles ────────────────────────────────────────────────────
const cardBase: React.CSSProperties = {
  backgroundColor: H.surface,
  border: `1px solid ${H.border}`,
  borderRadius: H.radius.xl,
  boxShadow: H.shadows.card,
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
      <ComponentErrorBoundary sectionName={`Stat Card (${label})`}>
        <Link
          href={href}
          style={{
            ...cardBase,
            padding: `${H.spacing.xl} ${H.spacing['2xl']}`,
            display: 'flex',
            flexDirection: 'column',
            gap: H.spacing.md,
            textDecoration: 'none',
            color: 'inherit',
            borderLeft: `4px solid ${color}`,
            transform: isHovered ? 'translateY(-3px)' : 'none',
            boxShadow: isHovered ? H.shadows.lg : H.shadows.card,
          }}
          onMouseEnter={onHover}
          onMouseLeave={onHover}
        >
          {/* Header row with perfect center alignment */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: H.spacing.sm }}>
            <span style={{ fontSize: H.fontSize.md, fontWeight: H.fontWeight.semibold, color: H.textSec, lineHeight: 1.2 }}>{label}</span>
            <Icon size={20} style={{ color, flexShrink: 0 }} />
          </div>
          {/* Value + footer */}
          <div>
            <div style={{ fontSize: '34px', fontWeight: H.fontWeight.extrabold, color: H.textPrimary, lineHeight: 1.1 }}>
              {value}
            </div>
            {footer && (
              <div style={{ fontSize: H.fontSize.sm, color: H.textMuted, marginTop: '4px' }}>{footer}</div>
            )}
          </div>
        </Link>
      </ComponentErrorBoundary>
    )
  }

  // variant === 'icon'
  const { value, label, icon: Icon, iconBg, iconColor, style } = props
  return (
    <ComponentErrorBoundary sectionName={`Stat Card (${label})`}>
      <div
        style={{
          ...cardBase,
          padding: H.spacing.xl,
          display: 'flex',
          alignItems: 'center',
          gap: H.spacing.lg,
          minWidth: 0,
          ...style,
        }}
      >
        <div
          style={{
            width: H.targetSizes.touchTarget,
            height: H.targetSizes.touchTarget,
            borderRadius: H.radius.xl,
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
          <div style={{ fontSize: '28px', fontWeight: H.fontWeight.extrabold, color: H.textPrimary, lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: H.fontSize.md, fontWeight: H.fontWeight.semibold, color: H.textSec, marginTop: '2px' }}>
            {label}
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  )
}
