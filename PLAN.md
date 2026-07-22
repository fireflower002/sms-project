# SMS Project — Refactoring Master Plan

## Context

School Management System — Next.js 14 App Router, TypeScript, inline CSS-in-JS
with `React.CSSProperties`, Supabase backend, Lucide icons.

**Analysed:** 2026-07-21  
**Analysis session:** `0dd1e99e-8874-4073-b4f9-97f6935a74ca`

---

## Stage 1-4 Findings (Original Analysis)

### Stage 1 — Design token duplication (root cause of incoherence)

The file `src/lib/honey.ts` exists and is the intended design-token file (`H.*`).  
At the time of analysis it was used in **only ~4 of 18 page files**.  
The other 14 pages each had their own `const colors = { ... }` copy-paste.

`honey.ts` exports:
- `H` — object with all colour tokens, shadows, fonts, grade colour array
- `STYLE` — global CSS string (font import, keyframes, scrollbar, body reset)

Three coexisting styling patterns were found:
1. Local `const colors` objects (majority of pages)
2. `H` tokens from `honey.ts` (classes, new sub-pages, layouts)
3. `createStyles` helper from `lib/styles.ts` (classes page only — one-off)

---

### Stage 2 — Absences + Swaps are the same feature

Both features:
- Modify `schedule_assignments` rows
- Require admin approval
- Surface together on the admin dashboard "Pending Actions" card
- Are navigated to separately from the sidebar

Additional bug found: `admin/swaps/page.tsx` line 136 — when a swap is approved,
no notification is sent to the requesting teacher. Teachers have no way of knowing
the outcome of their swap request.

**Recommendation:** Merge into a single `/admin/disruptions` tabbed page.

---

### Stage 3 — Navigation has 9 flat items (should be ~5 grouped)

Current admin sidebar items (flat):
> Dashboard · Teachers · Classes · Timetable · Inventory · Absences · Swaps · Requests · Announcements

These naturally group into:
| Group | Items |
|---|---|
| **People** | Teachers, Classes |
| **Schedule** | Timetable, Absences, Swaps |
| **Resources** | Inventory |
| **Communications** | Announcements, Requests |

Additional issues found:
- Mobile nav labels are missing or truncated
- Logout button appears twice in certain viewport widths

---

### Stage 4 — alert()/confirm() for destructive actions

Multiple pages use native browser `alert()` and `confirm()` dialogs for
destructive operations (delete timetable, delete announcement, deactivate teacher).
These are inconsistent with the app's design system and cannot be styled.

Affected pages:
- `admin/timetable/page.tsx` — delete timetable confirmation
- `admin/announcements/page.tsx` — delete announcement confirmation  
- `admin/teachers/page.tsx` — uses a custom modal already (`TeacherActions.tsx`);
  others should follow this pattern

---

## The Top 5

### #1 — honey.ts as single source of truth ✅ DONE
> Make `honey.ts` the one source of truth for all design tokens.  
> Standardize all primary buttons to amber (`H.accent = #F59E0B`).  
> See `PROGRESS.md` for full details.

**Scope:** 13 page files migrated. `admin/absences` and `admin/swaps` deferred to #5.

---

### #2 — Extract shared UI micro-components ⏳ NEXT
> Extract `StatCard`, `Badge`, `EmptyState`, `LoadingSpinner` into `components/ui/`.

**Scope:**
- **New:** `StatCard.tsx`, `Badge.tsx`, `EmptyState.tsx`, `LoadingSpinner.tsx`, `index.ts`
- **Target dir:** `src/components/ui/`  
  (currently only contains `HiveChat.tsx`)
- **Pages to update:** All ~15 app pages (both admin and teacher)
- **Do NOT touch:** `components/admin/`, `components/auth/`, `components/teacher/`, nav/layout

Full component specs (props API, inline patterns to replace) are in `PROGRESS.md`.

---

### #3 — Replace alert()/confirm() with ConfirmModal ⏳
> Build a `ConfirmModal` component and replace all native `alert()`/`confirm()`
> calls for destructive actions.

**New file:** `src/components/ui/ConfirmModal.tsx`

**Suggested API:**
```tsx
<ConfirmModal
  open={isOpen}
  title="Delete Timetable?"
  description="This cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

**Pages affected:**
- `admin/timetable/page.tsx`
- `admin/announcements/page.tsx`
- Any others found using `window.confirm()`

**Note:** `admin/teachers/page.tsx` already uses `TeacherActions.tsx` modal — keep
that pattern, just ensure it uses the new shared `ConfirmModal` internally.

---

### #4 — Admin sidebar: section groups + mobile fixes ⏳
> Add section group labels to admin sidebar nav.  
> Fix missing/truncated mobile nav labels.  
> Remove duplicate logout button.

**File:** `src/components/admin/AdminNav.tsx` (or equivalent nav component)  
**Scope:** Nav component only — do not touch page layouts.

**Grouping:**

```
[Dashboard]

People
  └ Teachers
  └ Classes

Schedule
  └ Timetable
  └ Absences & Swaps  ← after #5, this becomes one link

Resources
  └ Inventory

Communications
  └ Announcements
  └ Profile Requests
```

---

### #5 — Merge Absences + Swaps into "Disruptions" tabbed page ⏳
> Combine `admin/absences/page.tsx` and `admin/swaps/page.tsx` into a single
> `/admin/disruptions` page with two tabs: **Absences** and **Swaps**.

**New route:** `src/app/admin/disruptions/page.tsx`  
**Delete:** `src/app/admin/absences/page.tsx` (or redirect)  
**Delete:** `src/app/admin/swaps/page.tsx` (or redirect)

**Bug to fix during merge:**  
When a swap is approved, no notification is sent to the requesting teacher.  
Add notification insert to the swap approval handler.

**Note:** `admin/absences/page.tsx` and `admin/swaps/page.tsx` still have local
`const colors` objects (deferred from Item #1). The honey.ts migration for these
two files should be done as part of this item before merging.

---

## File Map (as of Item #1 completion)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              — uses H (pre-existing)
│   │   └── teacher/login/page.tsx      — uses H (pre-existing)
│   ├── admin/
│   │   ├── page.tsx                    ✅ H migrated
│   │   ├── layout.tsx                  — uses H (pre-existing)
│   │   ├── absences/page.tsx           ⏳ still has local colors (Item #5)
│   │   ├── announcements/page.tsx      ✅ H migrated
│   │   ├── classes/page.tsx            — uses H (pre-existing)
│   │   ├── inventory/page.tsx          ✅ H migrated
│   │   ├── profile-requests/page.tsx   ✅ H migrated
│   │   ├── swaps/page.tsx              ⏳ still has local colors (Item #5)
│   │   ├── teachers/page.tsx           ✅ H migrated
│   │   └── timetable/page.tsx          ✅ H migrated
│   ├── teacher/
│   │   ├── page.tsx                    ✅ H migrated
│   │   ├── layout.tsx                  — uses H (pre-existing)
│   │   ├── announcements/page.tsx      ✅ H migrated
│   │   ├── profile/page.tsx            ✅ H migrated
│   │   ├── report-absence/page.tsx     ✅ H migrated
│   │   ├── swaps/page.tsx              ✅ H migrated
│   │   ├── swaps/new/page.tsx          ✅ H migrated
│   │   └── timetable/page.tsx          ✅ H migrated
│   └── reset-password/page.tsx         — uses H (pre-existing)
├── components/
│   ├── admin/
│   │   ├── AddTeacherModal.tsx
│   │   └── TeacherActions.tsx
│   ├── auth/
│   │   └── LoginForm.tsx
│   ├── teacher/
│   │   └── Clock.tsx
│   └── ui/
│       └── HiveChat.tsx                — only existing shared UI component
└── lib/
    ├── honey.ts                        ← canonical design tokens
    ├── styles.ts                       ← createStyles helper (used minimally)
    └── utils.ts
```

---

## Token Quick Reference (`src/lib/honey.ts`)

```ts
H.bg           = '#FAFAF8'   // page background
H.surface      = '#FFFFFF'   // card/surface background
H.border       = '#E8E4DD'   // card/input border
H.cardShadow   = '0 2px 8px rgba(0,0,0,0.06)'
H.text         = '#1C1917'   // primary text
H.muted        = '#78716C'   // secondary text
H.sub          = '#A8A29E'   // tertiary / placeholder
H.accent       = '#F59E0B'   // ★ primary amber (buttons, highlights)
H.accentDark   = '#92400E'   // amber text on light bg
H.accentLight  = '#FEF3C7'   // amber tint bg
H.honey        = '#F59E0B'   // alias of accent
H.chocolate    = '#92400E'   // alias of accentDark
H.grass        = '#10B981'   // success green
H.successGreen = '#10B981'
H.successLight = '#D1FAE5'
H.danger       = '#EF4444'   // error red  ← was #DC2626 in old local objects
H.dangerLight  = '#FEF2F2'
H.skyBlue      = '#3B82F6'
H.skyLight     = '#EFF6FF'
H.softPink     = '#EC4899'
H.softPinkLight= '#FDF2F8'
H.softPinkDark = '#9D174D'   // NB: pages used #831843 — kept as literal
H.mintGreen    = '#06B6D4'
H.mintLight    = '#ECFEFF'
H.purple       = '#8B5CF6'
H.textPrimary  = '#1C1917'
H.textSec      = '#78716C'
H.textMuted    = '#A8A29E'
H.font         = "'Plus Jakarta Sans', sans-serif"
H.lightBg      = '#FAFAF8'   // alias of bg
H.cardBg       = '#FFFFFF'   // alias of surface
H.cardBorder   = '#E8E4DD'   // alias of border
H.gradeColors  = [ /* 13 colours cycling for grades 1-13 */ ]
```
