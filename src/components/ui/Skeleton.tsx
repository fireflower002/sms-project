import React from 'react'
import { H } from '@/lib/honey'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

/**
 * Basic pulsing skeleton block element.
 */
export function SkeletonBlock({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  style,
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#E7E5E4',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/**
 * Skeleton component mirroring the Admin & Teacher Dashboard layout shell.
 */
export function DashboardSkeleton() {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header Bar Skeleton */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SkeletonBlock width="220px" height="24px" style={{ marginBottom: '8px' }} />
            <SkeletonBlock width="160px" height="14px" />
          </div>
          <SkeletonBlock width="140px" height="28px" borderRadius="20px" />
        </div>

        {/* Metric Strip Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', borderBottom: `1px solid ${H.border}` }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: '18px 24px', borderRight: i < 4 ? `1px solid ${H.border}` : 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBlock width="90px" height="12px" />
                <SkeletonBlock width="16px" height="16px" borderRadius="4px" />
              </div>
              <SkeletonBlock width="50px" height="28px" />
            </div>
          ))}
        </div>

        {/* Content Section Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <div style={{ padding: '24px', borderRight: `1px solid ${H.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <SkeletonBlock width="180px" height="18px" />
              <SkeletonBlock width="60px" height="14px" />
            </div>
            {/* Table Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map((r) => (
                <div key={r} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                  <SkeletonBlock width="35%" height="16px" />
                  <SkeletonBlock width="40%" height="16px" />
                  <SkeletonBlock width="20%" height="16px" />
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '24px', backgroundColor: '#FAF9F6' }}>
            <SkeletonBlock width="180px" height="18px" style={{ marginBottom: '20px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2].map((a) => (
                <div key={a} style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: H.surface, border: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <SkeletonBlock width="120px" height="14px" style={{ marginBottom: '6px' }} />
                    <SkeletonBlock width="180px" height="12px" />
                  </div>
                  <SkeletonBlock width="80px" height="22px" borderRadius="12px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}

/**
 * Skeleton component mirroring Data Tables (Disruptions, Classes, Inventory, Teachers).
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden', padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <SkeletonBlock width="180px" height="24px" style={{ marginBottom: '6px' }} />
            <SkeletonBlock width="240px" height="14px" />
          </div>
          <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <SkeletonBlock width="220px" height="38px" borderRadius="10px" />
          <SkeletonBlock width="120px" height="38px" borderRadius="10px" />
        </div>

        {/* Table Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: `1px solid ${H.border}`, paddingTop: '16px' }}>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div key={rIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${H.border}`, paddingBottom: '14px' }}>
              {Array.from({ length: columns }).map((_, cIdx) => (
                <SkeletonBlock key={cIdx} width={`${100 / columns - 5}%`} height="16px" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}

/**
 * Skeleton component mirroring Timetable View Grid.
 */
export function TimetableSkeleton() {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <SkeletonBlock width="200px" height="24px" />
          <SkeletonBlock width="140px" height="36px" borderRadius="10px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map((day) => (
            <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <SkeletonBlock width="100%" height="28px" borderRadius="8px" />
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <SkeletonBlock key={p} width="100%" height="60px" borderRadius="8px" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}

export default SkeletonBlock
