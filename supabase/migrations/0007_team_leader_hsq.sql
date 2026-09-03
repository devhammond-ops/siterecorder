-- Step 1 of 2: add team_leader enum value (must commit before it can be used).
-- Run this alone in the SQL Editor, then run 0008_hsq_reports.sql.

alter type public.user_role add value if not exists 'team_leader';

-- Optional site code on installations — used to link workers to an HSQ report.
alter table public.installations
  add column if not exists site_id text;

create index if not exists installations_site_id_date_idx
  on public.installations (site_id, date_installation)
  where site_id is not null and trim(site_id) <> '';

comment on column public.installations.site_id is
  'Worksite identifier entered on installations; used for HSQ worker lookup.';
