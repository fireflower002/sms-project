'use client'

export default function ItemError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Item Details Unavailable</h2>
      <p style={{ color: '#666' }}>{error?.message || 'Could not fetch item barcode information.'}</p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: '16px',
          padding: '10px 20px',
          backgroundColor: '#18181B',
          color: '#FFF',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  )
}
