// Light theme design tokens — unified modern slate design system
export const H = {
  // Core palette (Refined Slate / Zinc)
  honey:      '#18181B',              // primary slate dark
  chocolate:  '#09090B',              // primary high-contrast text
  grass:      '#166534',              // green for success states (WCAG AA compliant)
  bg:         '#FAFAFA',              // main page background (subtle clean neutral)
  surface:    '#FFFFFF',              // card/surface background (pure white)
  border:     '#E4E4E7',              // crisp hairline border (Zinc 200)
  text:       '#09090B',              // primary text (Zinc 950)
  muted:      '#52525B',              // secondary text (Zinc 600)
  sub:        '#71717A',              // tertiary text / placeholder (Zinc 500)
  danger:     '#991B1B',              // error red (Red 800)
  dangerLight:'#FEF2F2',              // error background tint (Red 50)
  warning:    '#854D0E',              // warning amber (Amber 800)
  purple:     '#6366F1',              // indigo accent
  purpleLight:'#EEF2FF',              // indigo tint
  purpleDark: '#3730A3',              // dark indigo text

  // Light-theme aliases (Clean Slate / Zinc)
  cardBg:     '#FFFFFF',
  cardBorder: '#E4E4E7',
  cardShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
  lightBg:    '#FAFAFA',
  accent:     '#18181B',
  accentDark: '#09090B',
  accentLight:'#F4F4F5',
  successGreen:'#166534',
  successLight:'#F0FDF4',
  skyBlue:    '#2563EB',
  skyLight:   '#EFF6FF',
  skyDark:    '#1E40AF',
  scheduleBlue:     '#6366F1',
  schedulePurple:   '#6366F1',
  scheduleLight:    '#EEF2FF',
  scheduleDark:     '#3730A3',
  softPink:   '#BE185D',
  softPinkLight:'#FDF2F8',
  softPinkDark:'#831843',
  mintGreen:  '#0E7490',
  mintLight:  '#ECFEFF',
  textPrimary:'#09090B',
  textSec:    '#52525B',
  textMuted:  '#71717A',

  // Grade-level color palette (Subtle, professional tones)
  gradeColors: [
    '#2563EB', '#166534', '#4F46E5', '#9333EA', '#0891B2',
    '#D97706', '#EA580C', '#65A30D', '#DC2626', '#0284C7',
    '#059669', '#E11D48', '#7C3AED',
  ],

  // Fonts
  font: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",

  // Centralized Spacing Scale (4px Grid)
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

  // Centralized 3-Tier Font Weight Scale (No 800/900 bloat)
  fontWeight: {
    regular:   400, // Body text & metadata descriptions
    medium:    500, // Interactive labels, form fields & status pills
    semibold:  600, // Subheadings, table headers & active states
    bold:      600, // Page headers & metric values (capped at 600 for clean look)
    extrabold: 600,
    black:     600,
  },

  // Centralized Border Radius Scale
  radius: {
    xs:   '4px',
    sm:   '6px',
    md:   '8px',
    lg:   '10px',
    xl:   '12px',
    '2xl':'14px',
    '3xl':'16px',
    full: '9999px',
  },

  // Centralized Common Target Sizes
  targetSizes: {
    buttonSm:    '32px',
    buttonSmVal: '32px',
    buttonMd:    '36px',
    buttonLg:    '40px',
    input:       '38px',
    touchTarget: '44px',
  },

  // Refined Layered Hairline Shadow Tokens
  shadows: {
    sm:       '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    card:     '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
    dropdown: '0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
    lg:       '0 6px 16px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
    modal:    '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
  },

  // Centralized Motion Tokens
  motion: {
    transitionFast:   'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionNormal: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transitionSlow:   'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    hoverLift:        'translateY(-1px)',
    activePress:      'scale(0.98)',
  },
} as const;

export const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes modalScale { from { opacity: 0; transform: scale(0.98) translateY(4px) } to { opacity: 1; transform: scale(1) translateY(0) } }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: ${H.bg};
    color: ${H.text};
    font-family: ${H.font};
    margin: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }

  .tabular-nums, table, [data-tabular], .stat-value, .metric-value {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
  }

  button, input, select, textarea, a.button-link {
    font-family: inherit;
    transition: ${H.motion.transitionFast};
  }

  button:active:not(:disabled), a.button-link:active {
    transform: ${H.motion.activePress};
  }

  .interactive-card {
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .interactive-card:hover {
    border-color: #D4D4D8 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  }

  tr.interactive-row {
    transition: background-color 0.15s ease;
  }
  tr.interactive-row:hover {
    background-color: #F4F4F5 !important;
  }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(113,113,122,0.25); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(113,113,122,0.4); }
`;


