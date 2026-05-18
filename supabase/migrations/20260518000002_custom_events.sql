CREATE TABLE IF NOT EXISTS custom_events (
  id          TEXT        NOT NULL,
  group_id    UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_name   TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  start_time  TEXT        NOT NULL,
  end_time    TEXT        NOT NULL,
  location    TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, group_id)
);

ALTER TABLE custom_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON custom_events FOR SELECT USING (true);
CREATE POLICY "public_insert" ON custom_events FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON custom_events FOR UPDATE USING (true);
CREATE POLICY "public_delete" ON custom_events FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON custom_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_events TO authenticated;

ALTER TABLE custom_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_events;
