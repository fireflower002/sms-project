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
 * Skeleton component mirroring Data Tables (Disruptions, Inventory, etc.).
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

/**
 * Skeleton component mirroring Card Lists (Announcements, Timetable Templates, Swaps).
 */
export function CardListSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SkeletonBlock width="200px" height="24px" style={{ marginBottom: '6px' }} />
            <SkeletonBlock width="260px" height="14px" />
          </div>
          <SkeletonBlock width="120px" height="38px" borderRadius="10px" />
        </div>

        {/* Toolbar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6', display: 'flex', gap: '12px' }}>
          <SkeletonBlock width="240px" height="36px" borderRadius="8px" />
          <SkeletonBlock width="100px" height="36px" borderRadius="8px" />
          <SkeletonBlock width="100px" height="36px" borderRadius="8px" />
        </div>

        {/* Cards Stack */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: cards }).map((_, idx) => (
            <div key={idx} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SkeletonBlock width="160px" height="18px" />
                <SkeletonBlock width="90px" height="14px" />
              </div>
              <SkeletonBlock width="85%" height="14px" />
              <SkeletonBlock width="60%" height="14px" />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <SkeletonBlock width="70px" height="22px" borderRadius="12px" />
                <SkeletonBlock width="90px" height="22px" borderRadius="12px" />
              </div>
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
 * Skeleton component mirroring Form Cards (Report Absence, New Swap, Absence Detail).
 */
export function FormCardSkeleton() {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div>
          <SkeletonBlock width="200px" height="26px" style={{ marginBottom: '8px' }} />
          <SkeletonBlock width="280px" height="16px" />
        </div>

        {/* Form Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SkeletonBlock width="100%" height="44px" borderRadius="10px" />
          <SkeletonBlock width="100%" height="44px" borderRadius="10px" />
          <SkeletonBlock width="100%" height="100px" borderRadius="10px" />
          <SkeletonBlock width="140px" height="42px" borderRadius="10px" style={{ alignSelf: 'flex-end' }} />
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
 * Skeleton component mirroring 2-Column Profile Detail views (e.g. /admin/teachers/[id]).
 */
export function ProfileDetailSkeleton() {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonBlock width="220px" height="20px" />
        <SkeletonBlock width="110px" height="34px" borderRadius="8px" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left Profile Info Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <SkeletonBlock width="56px" height="56px" borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonBlock width="160px" height="20px" />
              <SkeletonBlock width="200px" height="14px" />
            </div>
          </div>
          <div style={{ height: '1px', backgroundColor: H.border, margin: '8px 0' }} />
          <SkeletonBlock width="100%" height="40px" borderRadius="10px" />
          <SkeletonBlock width="100%" height="40px" borderRadius="10px" />
          <SkeletonBlock width="100%" height="40px" borderRadius="10px" />
        </div>

        {/* Right Info / Schedule Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SkeletonBlock width="180px" height="20px" />
            <SkeletonBlock width="100%" height="60px" borderRadius="10px" />
            <SkeletonBlock width="100%" height="60px" borderRadius="10px" />
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
 * Skeleton component mirroring Public Item Detail scan verification card (/item/[token]).
 */
export function ItemDetailSkeleton() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: H.bg, padding: '24px 16px 60px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SkeletonBlock width="36px" height="36px" borderRadius="10px" />
            <div>
              <SkeletonBlock width="180px" height="16px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="120px" height="12px" />
            </div>
          </div>
          <SkeletonBlock width="70px" height="22px" borderRadius="20px" />
        </div>

        {/* Item Card */}
        <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <SkeletonBlock width="60px" height="60px" borderRadius="16px" />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="200px" height="22px" style={{ marginBottom: '8px' }} />
              <SkeletonBlock width="110px" height="16px" />
            </div>
          </div>
          <SkeletonBlock width="100%" height="52px" borderRadius="14px" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <SkeletonBlock width="100%" height="70px" borderRadius="14px" />
            <SkeletonBlock width="100%" height="70px" borderRadius="14px" />
          </div>
          <SkeletonBlock width="100%" height="80px" borderRadius="14px" />
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
 * Skeleton component mirroring Grade Cards with Class Pills (/admin/classes).
 */
export function GradeCardsSkeleton({ gradeCount = 3 }: { gradeCount?: number }) {
  return (
    <div style={{ backgroundColor: H.bg, minHeight: '100vh', padding: 'clamp(16px, 3vw, 28px)', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden' }}>
        {/* Header Bar */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <SkeletonBlock width="180px" height="24px" style={{ marginBottom: '6px' }} />
            <SkeletonBlock width="240px" height="14px" />
          </div>
          <SkeletonBlock width="110px" height="38px" borderRadius="10px" />
        </div>

        {/* Toolbar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${H.border}`, backgroundColor: '#FAF9F6', display: 'flex', gap: '12px' }}>
          <SkeletonBlock width="220px" height="36px" borderRadius="8px" />
          <SkeletonBlock width="120px" height="36px" borderRadius="8px" />
        </div>

        {/* Grade Cards List */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Array.from({ length: gradeCount }).map((_, idx) => (
            <div key={idx} style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FAF9F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <SkeletonBlock width="44px" height="44px" borderRadius="12px" />
                  <div>
                    <SkeletonBlock width="90px" height="18px" style={{ marginBottom: '4px' }} />
                    <SkeletonBlock width="60px" height="12px" />
                  </div>
                </div>
                <SkeletonBlock width="110px" height="34px" borderRadius="8px" />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {[1, 2, 3].map((p) => (
                  <SkeletonBlock key={p} width="160px" height="34px" borderRadius="10px" />
                ))}
              </div>
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
 * Skeleton component mirroring Timetable Builder UI (/admin/timetable/[id]/build).
 */
export function TimetableBuilderSkeleton() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: H.bg, boxSizing: 'border-box' }}>
      {/* Builder Top Bar */}
      <div style={{ height: '64px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${H.border}`, backgroundColor: H.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SkeletonBlock width="32px" height="32px" borderRadius="8px" />
          <div>
            <SkeletonBlock width="160px" height="18px" style={{ marginBottom: '4px' }} />
            <SkeletonBlock width="220px" height="12px" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <SkeletonBlock width="130px" height="36px" borderRadius="8px" />
          <SkeletonBlock width="150px" height="36px" borderRadius="8px" />
        </div>
      </div>

      {/* 2-Column Builder Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar Palette */}
        <div style={{ width: '250px', borderRight: `1px solid ${H.border}`, backgroundColor: H.surface, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonBlock width="140px" height="14px" style={{ marginBottom: '8px' }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} width="100%" height="54px" borderRadius="10px" />
          ))}
        </div>

        {/* Main Matrix Grid */}
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <SkeletonBlock width="180px" height="36px" borderRadius="8px" />
            <SkeletonBlock width="220px" height="36px" borderRadius="8px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3, 4, 5, 6].map((p) => (
              <SkeletonBlock key={p} width="100%" height="68px" borderRadius="12px" />
            ))}
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
 * Skeleton component mirroring Staff Chat (/admin/chat and /teacher/chat).
 */
export function ChatSkeleton() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: H.bg, padding: '16px 24px', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: H.surface, border: `1px solid ${H.border}`, borderRadius: '16px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${H.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SkeletonBlock width="36px" height="36px" borderRadius="10px" />
            <div>
              <SkeletonBlock width="220px" height="18px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="140px" height="12px" />
            </div>
          </div>
          <SkeletonBlock width="100px" height="32px" borderRadius="8px" />
        </div>

        {/* Chat Bubbles Container */}
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start',
                width: `${30 + i * 12}%`,
              }}
            >
              <SkeletonBlock width="100%" height="56px" borderRadius="14px" />
            </div>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${H.border}`, backgroundColor: '#FAF9F6', display: 'flex', gap: '12px' }}>
          <SkeletonBlock width="100%" height="44px" borderRadius="12px" />
          <SkeletonBlock width="50px" height="44px" borderRadius="12px" />
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
