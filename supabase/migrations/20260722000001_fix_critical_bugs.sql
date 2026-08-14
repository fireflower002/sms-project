-- ============================================================
-- Fix execute_schedule_swap RPC function signature to accept p_swap_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.execute_schedule_swap(
  p_swap_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_swap RECORD;
  v_template_id uuid;
  v_day int;
BEGIN
  -- 1. Fetch swap request details
  SELECT * INTO v_swap FROM swap_requests WHERE id = p_swap_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap request % not found', p_swap_id;
  END IF;

  -- 2. Fetch active timetable template
  SELECT id INTO v_template_id FROM timetable_templates WHERE is_active = true LIMIT 1;
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'No active timetable template found';
  END IF;

  v_day := EXTRACT(ISODOW FROM v_swap.swap_date)::int;

  -- 3. Swap requester's period to target teacher
  IF v_swap.requester_class_id IS NOT NULL THEN
    UPDATE schedule_assignments
    SET teacher_id = v_swap.target_teacher_id
    WHERE template_id = v_template_id
      AND class_id = v_swap.requester_class_id
      AND day_of_week = v_day
      AND period_number = v_swap.requester_period;
  END IF;

  -- 4. Swap target's period to requester teacher
  IF v_swap.target_class_id IS NOT NULL THEN
    UPDATE schedule_assignments
    SET teacher_id = v_swap.requester_id
    WHERE template_id = v_template_id
      AND class_id = v_swap.target_class_id
      AND day_of_week = v_day
      AND period_number = v_swap.target_period;
  END IF;

  -- 5. Mark swap request as accepted
  UPDATE swap_requests
  SET status = 'accepted',
      admin_approved = true,
      admin_approved_at = now(),
      responded_at = now()
  WHERE id = p_swap_id;
END;
$$;

-- ============================================================
-- Add missing set_active_timetable RPC function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_active_timetable(template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is admin
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  UPDATE timetable_templates SET is_active = false;
  UPDATE timetable_templates SET is_active = true WHERE id = template_id;
END;
$$;

-- ============================================================
-- Add missing delete_timetable_template RPC function
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_timetable_template(template_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is admin
  IF public.get_user_role(auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  DELETE FROM schedule_assignments WHERE template_id = template_id;
  DELETE FROM timetable_templates WHERE id = template_id;
END;
$$;
