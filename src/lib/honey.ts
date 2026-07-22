// Light theme design tokens — unified across the entire application
export const H = {
  // Core palette
  honey:      '#F59E0B',              // primary amber/gold
  chocolate:  '#92400E',              // deep amber text on amber/light bg
  grass:      '#10B981',              // green for success states
  bg:         '#FAFAF8',              // page background (light warm cream/off-white)
  surface:    '#FFFFFF',              // card/surface background (pure white)
  border:     '#E8E4DD',              // soft border color
  text:       '#1C1917',              // primary text (dark warm charcoal)
  muted:      '#78716C',              // secondary text
  sub:        '#A8A29E',              // tertiary text / placeholder
  danger:     '#EF4444',              // error red
  dangerLight:'#FEF2F2',              // error background tint
  warning:    '#F59E0B',              // warning amber
  purple:     '#8B5CF6',              // purple accent
  purpleLight:'#F3E8FF',
  purpleDark: '#6B21A8',

  // Light-theme aliases
  cardBg:     '#FFFFFF',
  cardBorder: '#E8E4DD',
  cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
  lightBg:    '#FAFAF8',
  accent:     '#F59E0B',
  accentDark: '#92400E',
  accentLight:'#FEF3C7',
  successGreen:'#10B981',
  successLight:'#D1FAE5',
  skyBlue:    '#3B82F6',
  skyLight:   '#EFF6FF',
  skyDark:    '#1E40AF',
  scheduleBlue:     '#8B5CF6',
  schedulePurple:   '#8B5CF6',
  scheduleLight:    '#F3E8FF',
  scheduleDark:     '#6B21A8',
  softPink:   '#EC4899',
  softPinkLight:'#FDF2F8',
  softPinkDark:'#9D174D',
  mintGreen:  '#06B6D4',
  mintLight:  '#ECFEFF',
  textPrimary:'#1C1917',
  textSec:    '#78716C',
  textMuted:  '#A8A29E',

  // Grade-level color palette (cycled for grades 1-13)
  gradeColors: [
    '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EF4444', '#6366F1',
    '#14B8A6', '#F43F5E', '#A855F7',
  ],

  // Fonts
  font: "'Plus Jakarta Sans', sans-serif",
} as const;

export const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: ${H.bg};
    color: ${H.text};
    font-family: ${H.font};
    margin: 0;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(120,113,108,0.2); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(120,113,108,0.4); }
`;
