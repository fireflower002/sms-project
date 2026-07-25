import AdminSidebar from '@/components/admin/AdminSidebar'
import { H } from '@/lib/honey'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: H.lightBg }}>
      <AdminSidebar />
      <div className="admin-main-content" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {children}
        <style>{`
          @media (max-width: 767px) {
            .admin-main-content {
              padding-bottom: 80px;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
