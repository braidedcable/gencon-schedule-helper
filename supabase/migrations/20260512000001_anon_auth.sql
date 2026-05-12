-- Clear test data so no rows with NULL user_auth_id persist
TRUNCATE picks;

-- Add auth identity column
ALTER TABLE picks ADD COLUMN user_auth_id uuid REFERENCES auth.users(id);

-- Tighten insert: user_auth_id must match the caller's anonymous session
DROP POLICY IF EXISTS "public insert picks" ON picks;
CREATE POLICY "insert own picks" ON picks FOR INSERT
  WITH CHECK (auth.uid() = user_auth_id);

-- Tighten delete: only the session that created a row can delete it
DROP POLICY IF EXISTS "public delete picks" ON picks;
CREATE POLICY "delete own picks" ON picks FOR DELETE
  USING (auth.uid() = user_auth_id);
