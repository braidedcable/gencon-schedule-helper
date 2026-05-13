-- Grant table-level privileges to anon and authenticated roles.
-- RLS policies alone aren't enough; Postgres also needs explicit GRANTs.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.groups TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.picks TO anon, authenticated;
