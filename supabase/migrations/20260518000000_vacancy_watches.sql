CREATE TABLE vacancy_watches (
  event_id     TEXT        NOT NULL,
  session_id   UUID        NOT NULL,
  sold_out     BOOLEAN,
  last_checked TIMESTAMPTZ,
  PRIMARY KEY (event_id, session_id)
);

ALTER TABLE vacancy_watches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON vacancy_watches FOR SELECT USING (true);
CREATE POLICY "public_insert" ON vacancy_watches FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON vacancy_watches FOR UPDATE USING (true);
CREATE POLICY "public_delete" ON vacancy_watches FOR DELETE USING (true);

ALTER TABLE vacancy_watches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE vacancy_watches;
