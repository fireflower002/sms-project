-- Migration: 20260819000008_swap_conflict_validation_trigger.sql
-- Description: Enforces conflict validation BEFORE accepting or approving swap requests.

CREATE OR REPLACE FUNCTION validate_swap_conflict()
RETURNS TRIGGER AS $$
DECLARE
  v_req_name text;
  v_tgt_name text;
  v_req_period int;
  v_tgt_period int;
BEGIN
  -- Validate only when transitioning status to 'peer_accepted' or 'accepted'
  IF (NEW.status IN ('peer_accepted', 'accepted')) AND (OLD.status IS NULL OR OLD.status NOT IN ('peer_accepted', 'accepted')) THEN

    -- Fetch teacher names for descriptive error reporting
    SELECT full_name INTO v_req_name FROM profiles WHERE id = NEW.requester_id;
    SELECT full_name INTO v_tgt_name FROM profiles WHERE id = NEW.target_teacher_id;

    v_req_period := COALESCE(NEW.requester_period, 0);
    v_tgt_period := COALESCE(NEW.target_period, 0);

    -- 1. Check if Requester is marked absent on swap_date
    IF EXISTS (
      SELECT 1 FROM absences
      WHERE teacher_id = NEW.requester_id
        AND absence_date = NEW.swap_date
        AND status NOT IN ('rejected', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot accept swap: Requester (%) is marked absent on %.', COALESCE(v_req_name, 'Teacher'), NEW.swap_date;
    END IF;

    -- 2. Check if Target Teacher is marked absent on swap_date
    IF EXISTS (
      SELECT 1 FROM absences
      WHERE teacher_id = NEW.target_teacher_id
        AND absence_date = NEW.swap_date
        AND status NOT IN ('rejected', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot accept swap: Target teacher (%) is marked absent on %.', COALESCE(v_tgt_name, 'Teacher'), NEW.swap_date;
    END IF;

    -- 3. Check if Requester is assigned as a substitute cover during target_period on swap_date
    IF v_tgt_period > 0 AND EXISTS (
      SELECT 1 FROM substitutions s
      JOIN absences a ON s.absence_id = a.id
      WHERE s.substitute_teacher_id = NEW.requester_id
        AND a.absence_date = NEW.swap_date
        AND s.period_number = v_tgt_period
        AND a.status NOT IN ('rejected', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot accept swap: Requester (%) is already assigned to cover Period % on %.', COALESCE(v_req_name, 'Teacher'), v_tgt_period, NEW.swap_date;
    END IF;

    -- 4. Check if Target Teacher is assigned as a substitute cover during requester_period on swap_date
    IF v_req_period > 0 AND EXISTS (
      SELECT 1 FROM substitutions s
      JOIN absences a ON s.absence_id = a.id
      WHERE s.substitute_teacher_id = NEW.target_teacher_id
        AND a.absence_date = NEW.swap_date
        AND s.period_number = v_req_period
        AND a.status NOT IN ('rejected', 'cancelled')
    ) THEN
      RAISE EXCEPTION 'Cannot accept swap: Target teacher (%) is already assigned to cover Period % on %.', COALESCE(v_tgt_name, 'Teacher'), v_req_period, NEW.swap_date;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_swap_conflict ON swap_requests;

CREATE TRIGGER trg_validate_swap_conflict
  BEFORE INSERT OR UPDATE ON swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_swap_conflict();
