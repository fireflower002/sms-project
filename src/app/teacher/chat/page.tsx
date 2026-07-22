'use client'

import React from 'react'
import StaffChat from '@/components/chat/StaffChat'
import { H } from '@/lib/honey'
import { MessageSquare } from 'lucide-react'

export default function TeacherStaffChatPage() {
  return (
    <div className="chat-page-container" style={{ height: '100vh', maxHeight: '100vh', padding: '16px 24px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StaffChat height="100%" />
      <style>{`
        @media (max-width: 768px) {
          .chat-page-container {
            padding: 12px 12px 76px 12px !important;
            height: 100vh !important;
            max-height: 100vh !important;
          }
        }
      `}</style>
    </div>
  )
}
