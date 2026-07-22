import { H } from '@/lib/honey'

interface EmptyStateProps {
  /** Main heading text */
  title: string
  /** Secondary body text */
  description?: string
  /**
   * Optional Lucide (or any) icon node rendered above the title.
   * Sized / coloured by the caller, e.g. <GraduationCap size={48} />.
   */
  icon?: React.ReactNode
  /** Optional CTA button / link node rendered below the description */
  action?: React.ReactNode
  /** Extra styles forwarded to the outer wrapper div */
  style?: React.CSSProperties
}

/**
 * Empty-state placeholder component.
 *
 * Covers all variants found in the project:
 *   – with icon + title + description + CTA button (admin/classes)
 *   – with title + description only (admin/announcements, admin/inventory,
 *     admin/profile-requests, teacher/swaps, teacher/announcements,
 *     admin/timetable)
 *
 * Renders a centred card-like block. The caller decides whether to nest it
 * inside an existing card div or let EmptyState render standalone with a
 * built-in card surface (pass a `style` with the card look if needed).
 *
 * Examples:
 *   <EmptyState title="No Announcements Found" description="There are no announcements for the selected filter." />
 *
 *   <EmptyState
 *     icon={<GraduationCap size={48} style={{ color: H.sub }} />}
 *     title="No grades yet"
 *     description="Add a grade to create classes for your school"
 *     action={<button onClick={...} style={...}>Add First Grade</button>}
 *   />
 */
export default function EmptyState({
  title,
  description,
  icon,
  action,
  style,
}: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '64px 32px',
        color: H.textMuted,
        ...style,
      }}
    >
      {icon && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: '16px',
          fontWeight: 700,
          color: H.textPrimary,
          margin: '0 0 8px',
        }}
      >
        {title}
      </h3>
      {description && (
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: H.textMuted }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  )
}
