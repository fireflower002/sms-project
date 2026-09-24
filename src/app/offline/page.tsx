import React from 'react'
import { H } from '@/lib/honey'
import { WifiOff, RefreshCw } from 'lucide-react'

export const metadata = {
  title: 'Offline | School Management System',
  description: 'You are currently offline',
}

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: H.bg,
        color: H.text,
        fontFamily: H.font,
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: H.surface,
          border: `1px solid ${H.border}`,
          borderRadius: H.radius.xl,
          padding: '32px 24px',
          boxShadow: H.shadows.modal,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: H.accentLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <WifiOff size={32} color={H.honey} />
        </div>

        <h1
          style={{
            fontSize: H.fontSize['2xl'],
            fontWeight: H.fontWeight.bold,
            marginBottom: '12px',
            color: H.chocolate,
          }}
        >
          You are offline
        </h1>

        <p
          style={{
            fontSize: H.fontSize.base,
            color: H.muted,
            marginBottom: '24px',
            lineHeight: 1.5,
          }}
        >
          Please check your internet connection. Some features of the School Management System are unavailable while offline.
        </p>

        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: H.honey,
            color: '#FFFFFF',
            borderRadius: H.radius.md,
            fontWeight: H.fontWeight.medium,
            fontSize: H.fontSize.base,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} />
          Try Again
        </a>
      </div>
    </div>
  )
}
