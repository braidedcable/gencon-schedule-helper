-- Required for Supabase Realtime filtered subscriptions on INSERT events
ALTER TABLE messages REPLICA IDENTITY FULL;
