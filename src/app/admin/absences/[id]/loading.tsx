import React from 'react'
import { H } from '@/lib/honey'

export default function AbsenceDetailLoading() {
  return (
    <div style={{ padding: '24px', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '32px', width: '220px', backgroundColor: '#E4E4E7', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ height: '24px', width: '60%', backgroundColor: '#E4E4E7', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '18px', width: '40%', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '80px', width: '100%', backgroundColor: '#F4F4F5', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    </div>
  )
}
