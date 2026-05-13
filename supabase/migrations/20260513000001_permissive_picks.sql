-- Revert picks policies to permissive (no anonymous auth required).
-- The auth-scoped policies from 20260512000001 require anonymous sign-ins
-- to be enabled in the Supabase dashboard; permissive policies work for a
-- small trusted-friends group without that dependency.
DROP POLICY IF EXISTS "insert own picks" ON picks;
DROP POLICY IF EXISTS "delete own picks" ON picks;
CREATE POLICY "insert picks" ON picks FOR INSERT WITH CHECK (true);
CREATE POLICY "delete picks" ON picks FOR DELETE USING (true);
