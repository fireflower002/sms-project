'use client'

import React from 'react'
import StaffChat from '@/components/chat/StaffChat'
import { H } from '@/lib/honey'
import { MessageSquare } from 'lucide-react'

export default function AdminStaffChatPage() {
  return (
    <div style={{ minHeight: '100vh', background: H.lightBg, padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: '#FEF3C7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.15)',
              }}
            >
              <MessageSquare size={22} style={{ color: '#D97706' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: H.textPrimary, margin: 0 }}>
                Staff Communication Channel
              </h1>
              <p style={{ fontSize: '13px', color: H.textMuted, margin: '2px 0 0' }}>
                Real-time group discussion for administrators and teachers
              </p>
            </div>
          </div>
        </div>

        {/* Dedicated Staff Chat Component */}
        <StaffChat height="calc(100vh - 170px)" />
      </div>
    </div>
  )
}
