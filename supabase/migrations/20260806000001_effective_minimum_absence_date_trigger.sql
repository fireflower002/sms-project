-- ============================================================
-- MIGRATION: 20260806_effective_minimum_absence_date_trigger.sql
-- Server-side Postgres Trigger for Effective Minimum Absence Date Enforcement
-- ============================================================

-- ROLLBACK SQL INSTRUCTIONS:
-- DROP TRIGGER IF EXISTS trg_check_effective_minimum_absence_date ON absences;
-- DROP FUNCTION IF EXISTS public.check_effective_minimum_absence_date();

CREATE OR REPLACE FUNCTION public.check_effective_minimum_absence_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now_slt        timestamp;
  v_today_date     date;
  v_current_time   time;
  v_dow            integer; -- 1=Monday ... 7=Sunday
  v_min_date       date;
  v_target_dow     integer;
BEGIN
  -- 1. Admins are exempt: skip date check if public.is_admin() is true
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Compute current timestamp and date in Asia/Colombo timezone
  v_now_slt      := now() AT TIME ZONE 'Asia/Colombo';
  v_today_date   := v_now_slt::date;
  v_current_time := v_now_slt::time;
  v_dow          := EXTRACT(ISODOW FROM v_now_slt)::integer; -- 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun

  -- 3. Calculate effective minimum allowed absence date based on 17:00 cutoff & weekend rules
  IF v_current_time < '17:00:00'::time THEN
    -- Before 5:00 PM
    IF v_dow IN (1, 2, 3, 4, 5) THEN
      v_min_date := v_today_date; -- Monday-Friday before 5pm -> Today
    ELSIF v_dow = 6 THEN
      v_min_date := v_today_date + 2; -- Saturday before 5pm -> Next Monday
    ELSIF v_dow = 7 THEN
      v_min_date := v_today_date + 1; -- Sunday before 5pm -> Next Monday
    END IF;
  ELSE
    -- At or after 5:00 PM (17:00:00)
    IF v_dow IN (1, 2, 3, 4) THEN
      v_min_date := v_today_date + 1; -- Mon-Thu after 5pm -> Tomorrow
    ELSIF v_dow = 5 THEN
      v_min_date := v_today_date + 3; -- Friday after 5pm -> Next Monday
    ELSIF v_dow = 6 THEN
      v_min_date := v_today_date + 2; -- Saturday after 5pm -> Next Monday
    ELSIF v_dow = 7 THEN
      v_min_date := v_today_date + 1; -- Sunday after 5pm -> Next Monday
    END IF;
  END IF;

  -- 4. Check if NEW.absence_date is earlier than minimum allowed date
  IF NEW.absence_date < v_min_date THEN
    RAISE EXCEPTION 'Absence date % is earlier than the minimum allowed date (%) for non-admin submissions. Submissions after 5:00 PM or on weekends must target the next working day.',
      NEW.absence_date, v_min_date;
  END IF;

  -- 5. Reject if NEW.absence_date itself falls on a weekend (Saturday or Sunday)
  v_target_dow := EXTRACT(ISODOW FROM NEW.absence_date)::integer;
  IF v_target_dow IN (6, 7) THEN
    RAISE EXCEPTION 'Absence date % falls on a weekend (%s). Absences can only be reported for school working days.',
      NEW.absence_date,
      CASE WHEN v_target_dow = 6 THEN 'Saturday' ELSE 'Sunday' END;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trg_check_effective_minimum_absence_date ON absences;

-- Attach BEFORE INSERT OR UPDATE trigger
CREATE TRIGGER trg_check_effective_minimum_absence_date
BEFORE INSERT OR UPDATE OF absence_date ON absences
FOR EACH ROW
EXECUTE FUNCTION public.check_effective_minimum_absence_date();
