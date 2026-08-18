import { H } from '@/lib/honey'

type BadgeVariant =
  | 'pending'    // amber — "pending" / "awaiting"
  | 'active'     // green — "active" / "approved"
  | 'inactive'   // stone — "inactive"
  | 'danger'     // red   — "rejected" / "error"
  | 'sky'        // blue  — "active template" star badge
  | 'category'   // grey  — neutral category / label
  | 'custom'     // caller supplies explicit bg/color

interface BadgeProps {
  /** Text label rendered inside the badge */
  children: React.ReactNode
  /** Preset colour variant (default 'category') */
  variant?: BadgeVariant
  /** Override background; used when variant='custom' */
  bg?: string
  /** Override text colour; used when variant='custom' */
  color?: string
  /** Optional leading icon node (e.g. <Clock size={12}/>) */
  icon?: React.ReactNode
  /** Extra inline styles forwarded to the span */
  style?: React.CSSProperties
}

const VARIANTS: Record<Exclude<BadgeVariant, 'custom'>, { bg: string; color: string; border: string }> = {
  pending:  { bg: '#FEFCE8', color: '#854D0E', border: '1px solid #FEF08A' },
  active:   { bg: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' },
  inactive: { bg: '#F4F4F5', color: '#52525B', border: '1px solid #E4E4E7' },
  danger:   { bg: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' },
  sky:      { bg: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' },
  category: { bg: '#F4F4F5', color: '#52525B', border: '1px solid #E4E4E7' },
}

const BASE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 9px',
  borderRadius: '9999px',
  fontSize: '11.5px',
  fontWeight: 500,
  lineHeight: 1.3,
}

/**
 * Pill badge component covering all colour variants used across the project.
 *
 * Preset variants:
 *   pending  – amber (accentLight / accentDark)
 *   active   – green (successLight / #065F46)
 *   inactive – stone (#F5F5F4 / textSec)
 *   danger   – red (dangerLight / danger)
 *   sky      – blue (skyLight / #1E40AF) — "Active template"
 *   category – neutral grey (#F3F4F6 / #4B5563)
 *   custom   – supply explicit `bg` and `color` props
 *
 * Examples:
 *   <Badge variant="active">Active</Badge>
 *   <Badge variant="pending" icon={<Clock size={12}/>}>2 Pending</Badge>
 *   <Badge variant="custom" bg={H.softPinkLight} color="#831843">Pinned</Badge>
 */
export default function Badge({
  children,
  variant = 'category',
  bg,
  color,
  icon,
  style,
}: BadgeProps) {
  const resolved =
    variant === 'custom'
      ? { bg: bg ?? H.accentLight, color: color ?? H.accentDark }
      : VARIANTS[variant]

  return (
    <span
      style={{
        ...BASE,
        backgroundColor: resolved.bg,
        color: resolved.color,
        border: (resolved as any).border || `1px solid ${H.border}`,
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  )
}
