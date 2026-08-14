-- Migration: Upgrade hive_messages table for WhatsApp-style group chat
-- Date: 2026-07-23

-- 1. Add new columns for editing and soft-deletion
ALTER TABLE public.hive_messages
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- 2. Index for fast pagination sorting by created_at
CREATE INDEX IF NOT EXISTS idx_hive_messages_pagination ON public.hive_messages (created_at DESC, id DESC);

-- 3. Update Row Level Security Policies
DROP POLICY IF EXISTS "hive_select" ON public.hive_messages;
DROP POLICY IF EXISTS "hive_insert" ON public.hive_messages;
DROP POLICY IF EXISTS "hive_update" ON public.hive_messages;
DROP POLICY IF EXISTS "hive_delete" ON public.hive_messages;
DROP POLICY IF EXISTS "hive_update_soft_delete" ON public.hive_messages;

-- Policy 1: Any staff member (admin or teacher) can read messages
CREATE POLICY "hive_select" ON public.hive_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

-- Policy 2: Any staff member can insert their own messages
CREATE POLICY "hive_insert" ON public.hive_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    )
  );

-- Policy 3: Users can edit their own non-deleted messages OR soft-delete if sender or admin
CREATE POLICY "hive_update" ON public.hive_messages
  FOR UPDATE USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy 4: Hard deletion policy (for admins or user deleting own)
CREATE POLICY "hive_delete" ON public.hive_messages
  FOR DELETE USING (
    auth.uid() = sender_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Enable Supabase Realtime for hive_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'hive_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hive_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 5. Automated 30-Day Retention Cleanup Function
CREATE OR REPLACE FUNCTION public.clean_old_hive_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.hive_messages
  WHERE created_at < (NOW() - INTERVAL '30 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Schedule daily cleanup via pg_cron if available
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule(
    'hive-messages-30day-cleanup',
    '0 0 * * *',
    'SELECT public.clean_old_hive_messages();'
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron might require superuser or dashboard extension toggle
  NULL;
END $$;
