'use client'

import React from 'react'
import StaffChat from '@/components/chat/StaffChat'
import { H } from '@/lib/honey'
import { MessageSquare } from 'lucide-react'

export default function TeacherStaffChatPage() {
  return (
    <div style={{ minHeight: '100vh', background: H.lightBg, padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <StaffChat height="calc(100vh - 120px)" />
      </div>
    </div>
  )
}
