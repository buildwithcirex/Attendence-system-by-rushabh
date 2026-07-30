-- Run this in the Supabase SQL editor.
--
-- Adds the per-session target the member picks at login (drives the dashboard
-- progress bar only — it never forces a logout).
alter table sessions
  add column if not exists target_minutes integer;

-- Cross-device resume auto-closes sessions left open from a previous day with
-- logout_type = 'abandoned'. logout_type is a plain text column today, so this
-- value inserts without any change. If you have added a CHECK constraint or an
-- enum to logout_type, extend it to allow 'abandoned', e.g.:
--
--   alter table sessions drop constraint if exists sessions_logout_type_check;
--   alter table sessions add constraint sessions_logout_type_check
--     check (logout_type in ('manual', 'auto', 'abandoned'));
