# Refactoring Progress

## Top 5 Item #1 — honey.ts Standardisation ✅ COMPLETE
**Completed:** 2026-07-21  
**Session:** `fab9032c-8a38-43d8-bf72-ef74954dd76b`

---

### What was done

Every page file had a copy-pasted `const colors = { ... }` design-token object
(13–22 keys per file). These were completely removed and replaced with direct
references to `H` from `src/lib/honey.ts`, which is the canonical single source
of truth for all design tokens.

---

### Key decisions

#### Token mapping (local key → `H.*`)

| Local key | Replacement | Notes |
|---|---|---|
| `primary_background` | `H.bg` | |
| `card_background` | `H.surface` | |
| `card_border` | `H.border` | |
| `card_shadow` | `H.cardShadow` | |
| `primary_accent` | `H.accent` | **= `#F59E0B` amber — primary button colour** |
| `primary_dark` | `H.accentDark` | |
| `primary_light` | `H.accentLight` | |
| `success_green` | `H.successGreen` | |
| `success_light` | `H.successLight` | |
| `danger_text` | `H.danger` | ⚠️ Value changed `#DC2626` → `#EF4444` |
| `danger_light` | `H.dangerLight` | |
| `text_primary` | `H.textPrimary` | |
| `text_secondary` | `H.textSec` | |
| `text_muted` | `H.textMuted` | |
| `soft_pink_accent` | `H.softPink` | |
| `soft_pink_light` | `H.softPinkLight` | |
| `sky_blue_accent` | `H.skyBlue` | |
| `sky_blue_light` | `H.skyLight` | |
| `mint_accent` / `mint_green_accent` | `H.mintGreen` | |
| `mint_light` | `H.mintLight` | |
| `input_background` | `H.bg` | |
| `input_border` | `H.border` | |
| `button_secondary_border` | `H.border` | |
| `gray_text` | `H.textSec` | |
| `alternate_row` | `H.bg` | |

#### Keys kept as inline literals (no matching H token)

| Key | Value | Reason |
|---|---|---|
| `success_dark` | `'#065F46'` | No token in honey.ts |
| `soft_pink_dark` | `'#831843'` | Differs from `H.softPinkDark = #9D174D`; kept local |
| `danger_border` | `'#FECACA'` | No token |
| `danger_dark` | `'#991B1B'` | No token |
| `sky_blue_dark` | `'#1E40AF'` | No token |
| `mint_dark` | `'#0E7490'` | No token |
| `button_secondary_bg` / `gray_light` | `'#F5F5F4'` | No token |
| `overlay_background` | `'rgba(28,25,23,0.6)'` | No token |

#### One real value mismatch resolved

`danger_text` was `#DC2626` in every page but `H.danger = #EF4444`. Replaced with
`H.danger` — honey.ts is now the enforced source of truth. The red is slightly
brighter and uniform across all pages.

#### Primary buttons are amber

Primary action buttons use `H.accent` (`#F59E0B`) for background and
`H.accentDark` (`#92400E`) for text/border. No page deviates from this.

---

### Files changed

| File | Change |
|---|---|
| `src/app/admin/page.tsx` | Removed `colors` block, added `import { H }` |
| `src/app/admin/inventory/page.tsx` | " |
| `src/app/admin/profile-requests/page.tsx` | " |
| `src/app/admin/teachers/page.tsx` | " |
| `src/app/admin/timetable/page.tsx` | " |
| `src/app/admin/announcements/page.tsx` | " |
| `src/app/teacher/page.tsx` | " |
| `src/app/teacher/announcements/page.tsx` | " |
| `src/app/teacher/profile/page.tsx` | " |
| `src/app/teacher/report-absence/page.tsx` | " |
| `src/app/teacher/swaps/new/page.tsx` | " |
| `src/app/teacher/swaps/page.tsx` | " |
| `src/app/teacher/timetable/page.tsx` | " |

**Not changed (deferred):**
- `src/app/admin/absences/page.tsx` — pending Item #5 (Absences+Swaps merge)
- `src/app/admin/swaps/page.tsx` — pending Item #5

**Verification:** `npx tsc --noEmit` → 0 errors. Zero `colors.` references remain
in any of the 13 migrated files.

---

## Top 5 Item #2 — Extract shared UI components — ⏳ NOT STARTED

See `PLAN.md` for full spec. See below for what item #2 needs to know.

---

### What Item #2 must know before starting

#### Context
`src/components/ui/` currently contains **only one file**: `HiveChat.tsx`.
Everything below is inline JSX repeated across pages.

#### 1. `StatCard`

Already partially extracted as a **local** component inside `src/app/admin/page.tsx`
(lines 139–148). Move it to `components/ui/StatCard.tsx`.

**Current signature:**
```tsx
StatCard({ href, label, value, icon: Icon, color, footer?, isHovered, onHover })
```

**Rendered as:**
```tsx
<Link href={href} style={{ ...card, ...statCard, borderLeft: `4px solid ${color}` }}
  onMouseEnter={onHover} onMouseLeave={onHover}>
  <div>  {/* header: label + icon */} </div>
  <div style={statCardValue}>{value}</div>
  {footer && <div style={statCardFooter}>{footer}</div>}
</Link>
```

**Pages that need it:** `admin/page.tsx` (already uses it locally), `teacher/page.tsx`
(has identical inline stat rows).

**Suggested final API:**
```tsx
<StatCard
  href="/admin/teachers"
  label="Teachers"
  value={42}
  icon={Users}
  color={H.skyBlue}
  footer="3 pending approval"
/>
```
Internal hover state should be self-managed (remove `isHovered`/`onHover` props).

---

#### 2. `LoadingSpinner`

**Current inline pattern (every page):**
```tsx
if (loading) return (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                 minHeight:'calc(100vh - 64px)' }}>
    <Loader2 size={32} style={{ color: H.accent, animation: 'spin 1s linear infinite' }} />
  </div>
)
```

The `spin` keyframe is declared in `H`'s `STYLE` export but not globally injected in most pages — they rely on it being present. Confirm the global `<style>{STYLE}</style>` is in the layout or inject it in the component.

**Suggested API:**
```tsx
<LoadingSpinner />                  // defaults: size=32, fullPage=true
<LoadingSpinner size={20} fullPage={false} />
```

**Pages that use it:** All 15+ pages.

---

#### 3. `Badge`

**Current inline styles in `admin/teachers/page.tsx` (representative):**
```tsx
badge:        { display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px',
                borderRadius:'9999px', fontSize:12, fontWeight:600 }
badgeActive:  { backgroundColor: H.successLight, color: '#065F46' }
badgeInactive:{ backgroundColor: '#F5F5F4',       color: H.textSec }
badgePending: { backgroundColor: H.accentLight,   color: H.accentDark }
```

Also used in `admin/announcements` (priority: high/medium/low with raw hex),
`admin/profile-requests`, `admin/swaps`, `admin/timetable/[id]`.

**Suggested API:**
```tsx
<Badge variant="active" />          // green
<Badge variant="inactive" />        // grey
<Badge variant="pending" />         // amber
<Badge variant="danger" />          // red
<Badge variant="info" />            // sky blue
<Badge>{children}</Badge>           // custom content
```
The `PRIORITY_COLORS` object in `admin/announcements/page.tsx` (lines 25-29) uses
raw hex for `high`/`medium`/`low` — these should map to `danger`/`pending`/`inactive`
badge variants after extraction.

---

#### 4. `EmptyState`

**Current inline pattern (varies slightly per page):**
```tsx
<div style={{ textAlign:'center', padding:'64px 24px' }}>
  <SomeIcon size={48} style={{ color: H.textMuted, marginBottom:16 }} />
  <h3 style={{ fontSize:16, fontWeight:700, color: H.textPrimary }}>No Items Found</h3>
  <p style={{ color: H.textSec, marginTop:8 }}>Try adjusting your filters.</p>
</div>
```

**Pages that use it:** `admin/inventory`, `admin/timetable`, `admin/classes`,
`teacher/timetable`, `teacher/swaps`, `admin/timetable/[id]/build`, `admin/timetable/view`.

**Suggested API:**
```tsx
<EmptyState
  icon={Package}
  title="No Items Found"
  description="Try adjusting your filters."
  action={<Button onClick={...}>Add Item</Button>}   // optional
/>
```

---

#### Files to touch in Item #2

**New files:**
- `src/components/ui/StatCard.tsx`
- `src/components/ui/LoadingSpinner.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/index.ts` (barrel export)

**Pages to update** (replace inline with component import):
All pages listed above under each component, including the two deferred pages
(`admin/absences`, `admin/swaps`) which can be migrated in this step even though
their `colors` blocks are pending Item #5.

**Do NOT touch in Item #2:**
- `src/components/` subdirectories (`admin/`, `auth/`, `teacher/`) — only `ui/`
- Navigation / layout files
