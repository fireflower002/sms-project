-- Migration: Add computed column function is_low_stock for inventory table
-- Allows PostgREST to filter low-stock items based on each item's individual low_stock_threshold (or default 5)
-- Usage in Supabase JS: .eq('is_low_stock', true)

CREATE OR REPLACE FUNCTION is_low_stock(inventory)
RETURNS boolean AS $$
  SELECT COALESCE($1.quantity_available, 0) <= COALESCE($1.low_stock_threshold, 5);
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION is_low_stock(inventory) IS 'Computed column function for PostgREST filtering of low stock inventory items.';
