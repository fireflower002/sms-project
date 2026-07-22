import { Loader2 } from 'lucide-react'
import { H } from '@/lib/honey'

interface LoadingSpinnerProps {
  /** Icon size in px (default 32) */
  size?: number
  /** Icon color (default H.accent) */
  color?: string
  /**
   * When true, wraps the spinner in a full-height centred container.
   * Pass the page background styles via `containerStyle` if needed.
   */
  centered?: boolean
  /** Extra styles forwarded to the outer container (only when centered=true) */
  containerStyle?: React.CSSProperties
}

/**
 * A standardised animated Loader2 spinner.
 *
 * Usage – inline:
 *   <LoadingSpinner size={28} color={H.mintGreen} />
 *
 * Usage – full-page centred:
 *   <LoadingSpinner centered containerStyle={{ backgroundColor: H.bg, minHeight: '100vh' }} />
 */
export default function LoadingSpinner({
  size = 32,
  color = H.accent,
  centered = false,
  containerStyle,
}: LoadingSpinnerProps) {
  const spinner = (
    <Loader2
      size={size}
      style={{ color, animation: 'spin 1s linear infinite' }}
    />
  )

  if (!centered) return spinner

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        ...containerStyle,
      }}
    >
      {spinner}
    </div>
  )
}
