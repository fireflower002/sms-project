import React from 'react'
import { H } from '@/lib/honey'

export default function ReportAbsenceLoading() {
  return (
    <div style={{ padding: '24px', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Skeleton */}
        <div>
          <div style={{ width: '200px', height: '26px', backgroundColor: '#E4E4E7', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '280px', height: '16px', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        </div>

        {/* Form Card Skeleton */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ width: '100%', height: '44px', backgroundColor: '#F4F4F5', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '100%', height: '44px', backgroundColor: '#F4F4F5', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '100%', height: '100px', backgroundColor: '#F4F4F5', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '140px', height: '42px', backgroundColor: '#E4E4E7', borderRadius: '10px', animation: 'pulse 1.5s infinite', alignSelf: 'flex-end' }} />
        </div>
      </div>
    </div>
  )
}
