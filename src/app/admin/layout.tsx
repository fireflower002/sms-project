import AdminSidebar from '@/components/admin/AdminSidebar'
import { H } from '@/lib/honey'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: H.lightBg }}>
      <AdminSidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
