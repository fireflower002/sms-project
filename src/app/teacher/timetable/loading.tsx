import React from 'react'
import { H } from '@/lib/honey'

export default function TeacherTimetableLoading() {
  return (
    <div style={{ padding: '24px', backgroundColor: H.bg, minHeight: '100vh', fontFamily: H.font }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ width: '220px', height: '28px', backgroundColor: '#E4E4E7', borderRadius: '8px', marginBottom: '8px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: '160px', height: '16px', backgroundColor: '#F4F4F5', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ width: '120px', height: '38px', backgroundColor: '#E4E4E7', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
        </div>

        {/* Timetable Grid Matrix Skeleton */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: '80px repeat(5, 1fr)', gap: '12px' }}>
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} style={{ height: '70px', backgroundColor: '#F4F4F5', borderRadius: '10px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
