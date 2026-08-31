-- Migration: 20260819000009_inventory_quantity_audit_trigger.sql
-- Description: Automatically logs inventory quantity changes to audit_logs without altering inventory_assignments.

CREATE OR REPLACE FUNCTION log_inventory_quantity_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Detect total or available quantity change
  IF (OLD.quantity_total IS DISTINCT FROM NEW.quantity_total) OR (OLD.quantity_available IS DISTINCT FROM NEW.quantity_available) THEN

    v_user_id := auth.uid();

    -- Insert audit log record
    INSERT INTO audit_logs (
      action,
      target_table,
      target_id,
      old_value,
      new_value,
      performed_by,
      created_at
    ) VALUES (
      'INVENTORY_QUANTITY_UPDATE',
      'inventory',
      NEW.id,
      jsonb_build_object(
        'quantity_total', OLD.quantity_total,
        'quantity_available', OLD.quantity_available
      ),
      jsonb_build_object(
        'quantity_total', NEW.quantity_total,
        'quantity_available', NEW.quantity_available
      ),
      v_user_id,
      now()
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_inventory_quantity_change ON inventory;

CREATE TRIGGER trg_log_inventory_quantity_change
  AFTER UPDATE ON inventory
  FOR EACH ROW
  EXECUTE FUNCTION log_inventory_quantity_change();
