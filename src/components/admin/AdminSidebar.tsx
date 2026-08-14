'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  ClipboardList,
  ArrowRightLeft,
  Megaphone,
  Archive,
  Bell,
  LogOut,
  Menu,
  X,
  GraduationCap,
  MessageSquare
} from 'lucide-react'
import { H } from '@/lib/honey'

export interface NavItemDef {
  href: string
  label: string
  icon: any
  color: string
}

export interface NavSectionDef {
  title: string | null
  items: NavItemDef[]
}

export const ADMIN_NAV_SECTIONS: NavSectionDef[] = [
  {
    title: null,
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, color: H.accent },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/teachers', label: 'Teachers', icon: Users, color: H.successGreen },
    ],
  },
  {
    title: 'Schedule',
    items: [
      { href: '/admin/timetable', label: 'Timetable', icon: Calendar, color: H.purple },
      { href: '/admin/classes', label: 'Classes', icon: BookOpen, color: H.purple },
      { href: '/admin/disruptions', label: 'Attendance & Coverage', icon: ClipboardList, color: H.purple },
    ],
  },
  {
    title: 'Resources',
    items: [
      { href: '/admin/inventory', label: 'Inventory', icon: Archive, color: H.mintGreen },
    ],
  },
  {
    title: 'Communications',
    items: [
      { href: '/admin/chat', label: 'Staff Chat', icon: MessageSquare, color: H.skyBlue },
      { href: '/admin/calendar', label: 'Calendar', icon: Calendar, color: H.skyBlue },
      { href: '/admin/announcements', label: 'Notices', icon: Megaphone, color: H.skyBlue },
      { href: '/admin/profile-requests', label: 'Requests', icon: Bell, color: H.skyBlue },
    ],
  },
]

export const ALL_ADMIN_NAV_ITEMS: NavItemDef[] = ADMIN_NAV_SECTIONS.flatMap(s => s.items)

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768)
    }
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
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const baseNavItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: H.spacing.md,
    padding: '9px 14px',
    borderRadius: H.radius.xl,
    textDecoration: 'none',
    fontSize: H.fontSize.base,
    fontWeight: H.fontWeight.semibold,
    transition: H.motion.transitionFast,
  }

  const NavItem = ({ href, label, icon: Icon, color }: NavItemDef) => {
    const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
    const isHovered = hovered === href

    const style: React.CSSProperties = {
      ...baseNavItemStyle,
      backgroundColor: active ? H.accentLight : isHovered ? H.bg : 'transparent',
      color: active ? H.accentDark : H.textSec,
      transform: isHovered && !active ? H.motion.hoverLift : 'none',
    }

    return (
      <Link
        href={href}
        style={style}
        onMouseEnter={() => setHovered(href)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => setMobileMenuOpen(false)}
      >
        <Icon size={18} color={active || isHovered ? color : H.textMuted} />
        <span>{label}</span>
      </Link>
    )
  }

  // ── Mobile Bottom Navigation Bar & Drawer ──
  if (isMobile) {
    const mobilePrimaryItems: NavItemDef[] = [
      { href: '/admin', label: 'Home', icon: LayoutDashboard, color: H.accent },
      { href: '/admin/teachers', label: 'Teachers', icon: Users, color: H.successGreen },
      { href: '/admin/timetable', label: 'Timetable', icon: Calendar, color: H.purple },
      { href: '/admin/chat', label: 'Staff Chat', icon: MessageSquare, color: H.skyBlue },
      { href: '/admin/announcements', label: 'Notices', icon: Megaphone, color: H.skyBlue },
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
            const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
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
                  backgroundColor: active ? H.accentLight : 'transparent',
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
              color: isMobileMenuOpen ? H.accent : H.textMuted,
              fontSize: '11px',
              fontWeight: isMobileMenuOpen ? '700' : '600',
              padding: '6px 4px',
              minHeight: H.targetSizes.touchTarget,
              minWidth: '44px',
              flex: 1,
              position: 'relative',
              borderRadius: H.radius.md,
              backgroundColor: isMobileMenuOpen ? H.accentLight : 'transparent',
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
                backgroundColor: H.accent,
              }} />
            )}
            <Menu size={19} color={isMobileMenuOpen ? H.accent : H.textMuted} />
            <span>More</span>
          </button>
        </nav>

        {isMobileMenuOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            maxHeight: '80vh',
            overflowY: 'auto',
            background: H.surface,
            borderTop: `1px solid ${H.border}`,
            padding: '20px 16px',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.12)'
          }}>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={22} color={H.textMuted} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {ADMIN_NAV_SECTIONS.map((section, idx) => (
                <div key={idx}>
                  {section.title && (
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: H.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginBottom: '6px',
                      paddingLeft: '4px',
                    }}>
                      {section.title}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {section.items.map(item => <NavItem key={item.href} {...item} />)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: `1px solid ${H.border}`,
              marginTop: 20,
              paddingTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: H.accentLight,
                  color: H.accentDark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700'
                }}>
                  {profile?.full_name?.charAt(0) || 'A'}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: H.textPrimary }}>
                    {profile?.full_name || 'Admin'}
                  </div>
                  <div style={{ fontSize: '12px', color: H.textSec }}>Administrator</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
              >
                <LogOut size={20} color={H.textMuted} />
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Desktop Sidebar ──
  return (
    <aside style={{
      width: '240px',
      flexShrink: 0,
      minHeight: '100vh',
      backgroundColor: H.surface,
      borderRight: `1px solid ${H.border}`,
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      fontFamily: H.font,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: `linear-gradient(145deg, ${H.accentLight}33, transparent)`,
        borderBottom: `1px solid ${H.border}`,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: H.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <GraduationCap size={20} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color: H.textPrimary }}>Hive SMS</div>
          <div style={{ fontSize: '12px', color: H.textSec, fontWeight: 500 }}>Admin Portal</div>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {ADMIN_NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            {section.title && (
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: H.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 10px 6px 10px',
              }}>
                {section.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {section.items.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>
        ))}
      </nav>

      {/* User Footer with Single Logout Button */}
      <div style={{
        padding: '16px 18px',
        borderTop: `1px solid ${H.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: H.accentLight,
          color: H.accentDark,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '15px'
        }}>
          {profile?.full_name?.charAt(0) || 'A'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 700,
            fontSize: '13px',
            color: H.textPrimary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {profile?.full_name || 'Admin User'}
          </div>
          <div style={{ fontSize: '12px', color: H.textSec }}>
            Administrator
          </div>
        </div>
        {/* Single LogOut button */}
        <button
          onClick={handleLogout}
          title="Sign Out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
        >
          <LogOut size={18} color={H.textMuted} />
        </button>
      </div>
    </aside>
  )
}

