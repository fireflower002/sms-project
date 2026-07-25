'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  ArrowRightLeft,
  Megaphone,
  User,
  KeyRound,
  LogOut,
  Menu,
  X,
  GraduationCap,
  MessageSquare
} from 'lucide-react'
import { H } from '@/lib/honey'

export interface TeacherNavItemDef {
  href: string
  label: string
  icon: any
  color: string
}

export interface TeacherNavSectionDef {
  title: string | null
  items: TeacherNavItemDef[]
}

export const TEACHER_NAV_SECTIONS: TeacherNavSectionDef[] = [
  {
    title: null,
    items: [
      { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard, color: H.accent },
    ],
  },
  {
    title: 'Schedule',
    items: [
      { href: '/teacher/timetable', label: 'Timetable', icon: Calendar, color: H.purple },
      { href: '/teacher/report-absence', label: 'Absence', icon: ClipboardList, color: H.purple },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/teacher/chat', label: 'Staff Chat', icon: MessageSquare, color: H.skyBlue },
      { href: '/teacher/announcements', label: 'Announcements', icon: Megaphone, color: H.skyBlue },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/teacher/profile', label: 'Profile', icon: User, color: H.successGreen },
    ],
  },
]

export const ALL_TEACHER_NAV_ITEMS: TeacherNavItemDef[] = TEACHER_NAV_SECTIONS.flatMap(s => s.items)

export default function TeacherSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', checkSize)
    checkSize()
    return () => window.removeEventListener('resize', checkSize)
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle()
        setProfile(data)
      }
    }
    fetchProfile()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const baseNavItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 14px',
    borderRadius: '12px',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
    minHeight: '40px',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  }

  const NavItem = ({ href, label, icon: Icon, color }: TeacherNavItemDef) => {
    const active = pathname === href || (href !== '/teacher' && pathname.startsWith(href))
    const isHovered = hovered === href

    const style: React.CSSProperties = {
      ...baseNavItemStyle,
      backgroundColor: active ? H.accentLight : isHovered ? H.bg : 'transparent',
      color: active ? H.accentDark : H.textSec,
    }

    return (
      <Link
        href={href}
        style={style}
        onMouseEnter={() => setHovered(href)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => setMobileMenuOpen(false)}
      >
        <Icon size={18} color={active ? color : isHovered ? color : H.textMuted} />
        <span>{label}</span>
      </Link>
    )
  }

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: H.surface,
        borderTop: `1px solid ${H.border}`,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', zIndex: 1000,
      }}>
        <nav style={{ display: 'flex', justifyContent: 'space-around', padding: '6px 0' }}>
          {ALL_TEACHER_NAV_ITEMS.slice(0, 4).map(({ href, label, icon: Icon, color }) => {
            const active = pathname === href || (href !== '/teacher' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                color: active ? color : H.textMuted,
                textDecoration: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: '600', minHeight: '44px'
              }}>
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileMenuOpen(!isMobileMenuOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: '2px',
            color: isMobileMenuOpen ? H.accent : H.textMuted, fontSize: '11px', fontWeight: '600', padding: '6px 12px', minHeight: '44px'
          }}>
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>

        {isMobileMenuOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: H.surface, borderTop: `1px solid ${H.border}`,
            padding: '16px', boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
            maxHeight: '80vh', overflowY: 'auto'
          }}>
            <button onClick={() => setMobileMenuOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={22} color={H.textMuted} />
            </button>

            {TEACHER_NAV_SECTIONS.map((sec, idx) => (
              <div key={idx} style={{ marginBottom: 14 }}>
                {sec.title && (
                  <div style={{
                    fontSize: '11px', fontWeight: 800, color: H.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    padding: '6px 14px 4px', margin: 0
                  }}>
                    {sec.title}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {sec.items.map(item => <NavItem key={item.href} {...item} />)}
                </div>
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${H.border}`, marginTop: 16, paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: H.accentLight, color: H.accentDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                  {profile?.full_name?.charAt(0) || 'T'}
                </div>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: H.textPrimary, display: 'block' }}>{profile?.full_name || 'Teacher'}</span>
                  <span style={{ fontSize: '12px', color: H.textSec }}>Teacher Portal</span>
                </div>
              </div>
              <button onClick={handleLogout} title="Sign Out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}>
                <LogOut size={20} color={H.textMuted} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside style={{
      width: '240px', minHeight: '100vh',
      backgroundColor: H.surface,
      borderRight: `1px solid ${H.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
      fontFamily: H.font,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 12,
        background: `linear-gradient(145deg, ${H.accentLight}33, transparent)`,
        borderBottom: `1px solid ${H.border}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12, background: H.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <GraduationCap size={20} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: H.textPrimary }}>Hive SMS</div>
          <div style={{ fontSize: '12px', color: H.textSec, fontWeight: 500 }}>Teacher Portal</div>
        </div>
      </div>

      {/* Nav List with Grouped Sections */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
        {TEACHER_NAV_SECTIONS.map((sec, idx) => (
          <div key={idx}>
            {sec.title && (
              <div style={{
                fontSize: '11px', fontWeight: 800, color: H.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                padding: '0 14px 6px', margin: 0
              }}>
                {sec.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {sec.items.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile Footer */}
      <div style={{
        padding: '16px 18px', borderTop: `1px solid ${H.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: H.accentLight,
          color: H.accentDark, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 700, fontSize: '15px'
        }}>
          {profile?.full_name?.charAt(0) || 'T'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700, fontSize: '13px', color: H.textPrimary,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {profile?.full_name || 'Teacher User'}
          </div>
          <div style={{ fontSize: '12px', color: H.textSec }}>
            Teacher
          </div>
        </div>
        <button onClick={handleLogout} title="Sign Out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <LogOut size={18} color={H.textMuted} />
        </button>
      </div>
    </aside>
  )
}
