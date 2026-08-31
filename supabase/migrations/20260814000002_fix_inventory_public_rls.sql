-- Migration: Fix Inventory RLS Security Leak & Expose Safe Public View

-- 1. Drop overly permissive public policy on inventory table
DROP POLICY IF EXISTS "inv_public_select_by_token" ON inventory;

-- 2. Ensure main inventory table requires authenticated role for direct queries
DROP POLICY IF EXISTS "inv_select" ON inventory;
CREATE POLICY "inv_select" ON inventory 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 3. Create secure public view for QR code verification (excluding purchase_price, purchase_date, created_by, internal notes, AND raw assigned_to user UUID)
CREATE OR REPLACE VIEW public_inventory_verification AS
SELECT 
  i.id,
  i.public_token,
  i.barcode,
  i.name,
  i.description,
  i.category,
  i.condition,
  i.condition_notes,
  i.quantity_total,
  i.quantity_available,
  i.location,
  CASE 
    WHEN p.role = 'teacher' THEN 'Assigned to a Teacher'
    WHEN p.role IS NOT NULL THEN CONCAT('Assigned to ', INITCAP(p.role), ' Staff')
    ELSE NULL
  END AS assigned_role,
  i.assigned_at,
  i.is_active
FROM inventory i
LEFT JOIN profiles p ON i.assigned_to::text = p.id::text
WHERE i.is_active = true;

-- 4. Grant SELECT on public view to anon and authenticated roles
GRANT SELECT ON public_inventory_verification TO anon, authenticated;
