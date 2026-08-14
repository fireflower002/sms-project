# Production Deployment Guide: School Calendar System

This document outlines the step-by-step production deployment process, database migration execution, environment variable requirements, initial data setup, rollback procedures, and troubleshooting guidelines.

---

## 1. Environment Variable Verification

Ensure the following environment variables are configured in your production hosting platform (Vercel / Netlify / Docker / Server):

```env
# Public Client Variables (Exposed to browser bundle)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
NEXT_PUBLIC_SITE_URL=https://<your-domain>.com

# Private Server-Only Variables (NEVER expose with NEXT_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_oU6IqLZ...
```

---

## 2. Supabase Migration Execution

### Strategy Option A: Supabase CLI (Recommended for Managed Deployments)
If using Supabase CLI with migration tracking:
```bash
# Push pending migrations to the linked remote database
npx supabase db push
```

### Strategy Option B: Supabase Dashboard SQL Editor (Direct SQL Execution)
If executing directly via Supabase Dashboard:
1. Log in to **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your production project and open **SQL Editor**.
3. Create a new query, paste the full contents of `supabase/migrations/20260804_school_calendar.sql`, and click **Run**.

### Post-Migration Verification Query
Execute the following SQL block in SQL Editor to confirm table creation and security policies:

```sql
-- 1. Confirm all 4 calendar tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('school_calendar_events', 'school_settings', 'calendar_sync_logs', 'calendar_audit_logs');

-- 2. Confirm RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('school_calendar_events', 'school_settings', 'calendar_sync_logs', 'calendar_audit_logs');

-- 3. Verify default school_settings record
SELECT * FROM public.school_settings WHERE school_id = 'default';
```

---

## 3. Initial Production Data Setup

1. **Verify Default Settings**:
   The migration automatically creates a default row in `school_settings`:
   - `absence_cutoff_hours_before`: `14` (hours before school day starts)
   - `working_days`: `['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']`
   - `allow_emergency_absence`: `true`
   - `timezone`: `'Asia/Colombo'`

2. **Run First Sri Lankan Holiday Synchronization**:
   - Log into the application as an Administrator.
   - Navigate to **Schedule** → **Calendar** (`/admin/calendar`).
   - Click the **Sync Sri Lankan Holidays** button.
   - Confirm that official public holidays (and Poya days) appear on the calendar grid and that `last_holiday_sync_at` updates.

3. **Verify Teacher Absence Validation**:
   - Log in as a Teacher user and open **Report an Absence** (`/teacher/report-absence`).
   - Confirm that date recommendations automatically adapt to Sri Lanka time (`Asia/Colombo`) and the 14-hour cutoff rule.

---

## 4. Rollback & Emergency Recovery

If a rollback of the calendar feature is required:

### Database Rollback SQL
```sql
-- Execute in Supabase SQL Editor to drop calendar tables cleanly:
DROP TABLE IF EXISTS calendar_audit_logs CASCADE;
DROP TABLE IF EXISTS calendar_sync_logs CASCADE;
DROP TABLE IF EXISTS school_calendar_events CASCADE;
DROP TABLE IF EXISTS school_settings CASCADE;
```

---

## 5. Basic Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Forbidden: Admin access required"** on Sync | User profile role is not set to `'admin'` | Verify profile role in `profiles` table: `UPDATE profiles SET role = 'admin' WHERE email = '...';` |
| **Holiday Sync fails with HTTP error** | External API temporary unavailability | Click **Sync Sri Lankan Holidays** again. Pre-existing local database holidays remain unaffected. |
| **Incorrect default date for Teacher** | Server / Client timezone mismatch | All calculations strictly enforce `Asia/Colombo` (`getCurrentSLTDate()`). Confirm device time is accurate. |
