-- Run manually in the Supabase SQL editor (this repo has no migration tooling).
-- Adds soft-delete support to members, sessions, tasks, and calendar_events.

alter table members add column if not exists deleted_at timestamptz;
alter table sessions add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists deleted_at timestamptz;
alter table calendar_events add column if not exists deleted_at timestamptz;

-- Marks rows that were soft-deleted as part of a member cascade-delete, so
-- restoring a member can restore exactly that batch of child rows and
-- nothing else (e.g. a session an admin independently deleted separately).
alter table sessions add column if not exists deleted_via_member_cascade boolean not null default false;
alter table tasks add column if not exists deleted_via_member_cascade boolean not null default false;
alter table calendar_events add column if not exists deleted_via_member_cascade boolean not null default false;

create index if not exists idx_members_deleted_at on members (deleted_at);
create index if not exists idx_sessions_deleted_at on sessions (deleted_at);
create index if not exists idx_tasks_deleted_at on tasks (deleted_at);
create index if not exists idx_calendar_events_deleted_at on calendar_events (deleted_at);
