'use client'
import { ComponentErrorBoundary } from '@/components/ui/ComponentErrorBoundary'

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <ComponentErrorBoundary sectionName="Teacher Portal">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h3>Teacher Portal Error: {error?.message || 'Failed loading section'}</h3>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#18181B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Retry Section
          </button>
        </div>
      </ComponentErrorBoundary>
    </div>
  )
}
