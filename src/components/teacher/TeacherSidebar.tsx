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
      { href: '/teacher', label: 'Dashboard', icon: LayoutDashboard, color: '#18181B' },
    ],
  },
  {
    title: 'Schedule',
    items: [
      { href: '/teacher/timetable', label: 'Timetable', icon: Calendar, color: '#71717A' },
      { href: '/teacher/report-absence', label: 'Absence', icon: ClipboardList, color: '#71717A' },
      { href: '/teacher/swaps', label: 'Cover Swaps', icon: ArrowRightLeft, color: '#71717A' },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/teacher/chat', label: 'Staff Chat', icon: MessageSquare, color: '#71717A' },
      { href: '/teacher/announcements', label: 'Announcements', icon: Megaphone, color: '#71717A' },
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
    gap: H.spacing.md,
    padding: '8px 12px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '13.5px',
    fontWeight: 500,
    minHeight: '36px',
    transition: H.motion.transitionFast,
  }

  const NavItem = ({ href, label, icon: Icon }: TeacherNavItemDef) => {
    const active = pathname === href || (href !== '/teacher' && pathname.startsWith(href))
    const isHovered = hovered === href

    const style: React.CSSProperties = {
      ...baseNavItemStyle,
      backgroundColor: active ? '#F4F4F5' : isHovered ? '#FAFAFA' : 'transparent',
      color: active ? '#09090B' : isHovered ? '#09090B' : H.textSec,
      fontWeight: active ? 600 : 500,
    }

    return (
      <Link
        href={href}
        style={style}
        onMouseEnter={() => setHovered(href)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => setMobileMenuOpen(false)}
      >
        <Icon size={18} color={active ? '#09090B' : isHovered ? '#09090B' : '#71717A'} />
        <span>{label}</span>
      </Link>
    )
  }

  if (isMobile) {
    // Include primary most-used teacher items directly on the bar (ordered identically to desktop sidebar)
    const mobilePrimaryItems: TeacherNavItemDef[] = [
      { href: '/teacher', label: 'Home', icon: LayoutDashboard, color: '#71717A' },
      { href: '/teacher/timetable', label: 'Timetable', icon: Calendar, color: '#71717A' },
      { href: '/teacher/report-absence', label: 'Absence', icon: ClipboardList, color: '#71717A' },
      { href: '/teacher/chat', label: 'Staff Chat', icon: MessageSquare, color: '#71717A' },
      { href: '/teacher/announcements', label: 'Notices', icon: Megaphone, color: '#71717A' },
    ]

    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: H.surface,
        borderTop: `1px solid ${H.border}`,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        zIndex: 1000,
      }}>
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '2px 4px',
        }}>
          {mobilePrimaryItems.map(({ href, label, icon: Icon, color }) => {
            const active = pathname === href || (href !== '/teacher' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  color: active ? color : H.textMuted,
                  textDecoration: 'none',
                  padding: '6px 4px',
                  fontSize: '11px',
                  fontWeight: active ? '700' : '600',
                  minHeight: H.targetSizes.touchTarget,
                  minWidth: '44px',
                  flex: 1,
                  position: 'relative',
                  borderRadius: H.radius.md,
                  backgroundColor: active ? '#F4F4F5' : 'transparent',
                  transition: H.motion.transitionFast,
                  boxSizing: 'border-box',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    width: '18px',
                    height: '3px',
                    borderRadius: H.radius.full,
                    backgroundColor: color,
                  }} />
                )}
                <Icon size={19} color={active ? color : H.textMuted} />
                <span>{label}</span>
              </Link>
            )
          })}
          <button
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              color: isMobileMenuOpen ? '#18181B' : H.textMuted,
              fontSize: '11px',
              fontWeight: isMobileMenuOpen ? '700' : '600',
              padding: '6px 4px',
              minHeight: H.targetSizes.touchTarget,
              minWidth: '44px',
              flex: 1,
              position: 'relative',
              borderRadius: H.radius.md,
              backgroundColor: isMobileMenuOpen ? '#F4F4F5' : 'transparent',
              transition: H.motion.transitionFast,
              boxSizing: 'border-box',
            }}
          >
            {isMobileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '2px',
                width: '18px',
                height: '3px',
                borderRadius: H.radius.full,
                backgroundColor: '#18181B',
              }} />
            )}
            <Menu size={19} color={isMobileMenuOpen ? '#18181B' : H.textMuted} />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: H.textPrimary }}>Navigation Menu</span>
              <button aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} color={H.textMuted} />
              </button>
            </div>

            {/* Profile & Sign Out prominently placed at TOP of drawer */}
            <div style={{
              backgroundColor: '#FAF9F6',
              border: `1px solid ${H.border}`,
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#18181B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                  {profile?.full_name?.charAt(0) || 'T'}
                </div>
                <div>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: H.textPrimary, display: 'block' }}>{profile?.full_name || 'Teacher'}</span>
                  <span style={{ fontSize: '11px', color: H.textSec }}>Teacher Portal</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
                style={{
                  background: '#DC2626',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  padding: '8px 14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 4px rgba(220,38,38,0.2)'
                }}
              >
                <LogOut size={15} color="#FFFFFF" />
                <span>Sign Out</span>
              </button>
            </div>

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
          </div>
        )}
      </div>
    )
  }

  return (
    <aside style={{
      width: '240px',
      flexShrink: 0,
      height: '100vh',
      backgroundColor: H.surface,
      borderRight: `1px solid ${H.border}`,
      display: 'flex', flexDirection: 'column',
      position: 'sticky', top: 0,
      fontFamily: H.font,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
        backgroundColor: H.surface,
        borderBottom: `1px solid ${H.border}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: '#18181B',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <GraduationCap size={18} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: H.textPrimary }}>Hive SMS</div>
          <div style={{ fontSize: '11px', color: H.textMuted, fontWeight: 500 }}>Teacher Portal</div>
        </div>
      </div>

      {/* Nav List with Grouped Sections */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
        {TEACHER_NAV_SECTIONS.map((sec, idx) => (
          <div key={idx}>
            {sec.title && (
              <div style={{
                fontSize: '11px', fontWeight: 600, color: H.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                padding: '0 10px 6px', margin: 0
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
        padding: '14px 16px', borderTop: `1px solid ${H.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
        backgroundColor: H.surface,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#F4F4F5',
          color: '#09090B', border: `1px solid ${H.border}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 600, fontSize: '13px'
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
        <button onClick={handleLogout} title="Sign Out" aria-label="Sign Out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <LogOut size={18} color={H.textMuted} />
        </button>
      </div>
    </aside>
  )
}
