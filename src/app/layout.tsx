import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { H } from '@/lib/honey'
import { ToastProvider } from '@/components/ui/Toast'

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'School Management System',
  description: 'Timetable, staff, inventory and communication for Sri Lankan schools',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/icon.svg" />
      </head>
      <body className={font.className} style={{ margin: 0, background: H.bg, color: H.text }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
