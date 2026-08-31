import React from 'react'
import { H } from '@/lib/honey'

export default function CalendarLoading() {
  return (
    <div style={{ padding: 'clamp(16px, 3vw, 32px)', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      {/* Header Bar Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ width: '280px', height: '28px', backgroundColor: '#E4E4E7', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '380px', height: '16px', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '180px', height: '40px', backgroundColor: '#E4E4E7', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '160px', height: '40px', backgroundColor: '#E4E4E7', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>

      {/* Sync Status Banner Skeleton */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: '300px', height: '20px', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '100px', height: '18px', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
      </div>

      {/* Toolbar Skeleton */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', backgroundColor: '#E4E4E7', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '140px', height: '24px', backgroundColor: '#E4E4E7', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '36px', height: '36px', backgroundColor: '#E4E4E7', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ width: '200px', height: '36px', backgroundColor: '#F4F4F5', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '140px', height: '36px', backgroundColor: '#F4F4F5', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>

      {/* Month Grid Skeleton */}
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} style={{ height: '16px', backgroundColor: '#E4E4E7', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} style={{ height: '90px', backgroundColor: '#F4F4F5', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
