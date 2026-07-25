// Light theme design tokens — unified across the entire application
export const H = {
  // Core palette (UNCHANGED)
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

  // Light-theme aliases (UNCHANGED)
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

  // Grade-level color palette (cycled for grades 1-13 - UNCHANGED)
  gradeColors: [
    '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6',
    '#06B6D4', '#F97316', '#84CC16', '#EF4444', '#6366F1',
    '#14B8A6', '#F43F5E', '#A855F7',
  ],

  // Fonts
  font: "'Plus Jakarta Sans', sans-serif",

  // Centralized Spacing Scale
  spacing: {
    xs:  '4px',
    sm:  '8px',
    md:  '12px',
    lg:  '16px',
    xl:  '20px',
    '2xl':'24px',
    '3xl':'32px',
    '4xl':'40px',
  },

  // Centralized Font Size Scale
  fontSize: {
    xs:     '11px',
    sm:     '12px',
    md:     '13px',
    base:   '14px',
    medium: '15px',
    lg:     '16px',
    xl:     '18px',
    '2xl':  '20px',
    '3xl':  '24px',
  },

  // Centralized Font Weight Scale
  fontWeight: {
    regular:   400,
    medium:    500,
    semibold:  600,
    bold:      700,
    extrabold: 800,
    black:     900,
  },

  // Centralized Border Radius Scale
  radius: {
    xs:   '4px',
    sm:   '6px',
    md:   '8px',
    lg:   '10px',
    xl:   '12px',
    '2xl':'16px',
    '3xl':'20px',
    full: '9999px',
  },

  // Centralized Common Target Sizes
  targetSizes: {
    buttonSm:    '36px',
    buttonMd:    '40px',
    buttonLg:    '44px',
    input:       '40px',
    touchTarget: '44px',
  },

  // Centralized Shadow Tokens
  shadows: {
    sm:       '0 1px 2px rgba(0,0,0,0.05)',
    card:     '0 2px 8px rgba(0,0,0,0.06)',
    dropdown: '0 -2px 8px rgba(0,0,0,0.06)',
    lg:       '0 4px 20px rgba(0,0,0,0.05)',
    modal:    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Centralized Motion & Micro-Animation Tokens
  motion: {
    transitionFast:   'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionNormal: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionSlow:   'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    hoverLift:        'translateY(-1px)',
    activePress:      'scale(0.98)',
  },
} as const;

export const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes modalScale { from { opacity: 0; transform: scale(0.96) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: ${H.bg};
    color: ${H.text};
    font-family: ${H.font};
    margin: 0;
    -webkit-font-smoothing: antialiased;
  }

  button, input, select, textarea {
    font-family: inherit;
    transition: ${H.motion.transitionFast};
  }

  button:active:not(:disabled) {
    transform: ${H.motion.activePress};
  }

  .interactive-card {
    transition: ${H.motion.transitionNormal};
  }
  .interactive-card:hover {
    transform: ${H.motion.hoverLift};
    border-color: #D6D1C7 !important;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(120,113,108,0.2); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(120,113,108,0.4); }
`;
