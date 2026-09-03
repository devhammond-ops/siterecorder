-- Team leader role and HSQ daily hazard assessment reports.

alter type public.user_role add value if not exists 'team_leader';

-- Optional site code on installations — used to link workers to an HSQ report.
alter table public.installations
  add column if not exists site_id text;

create index if not exists installations_site_id_date_idx
  on public.installations (site_id, date_installation)
  where site_id is not null and trim(site_id) <> '';

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function private.is_team_leader()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'team_leader'
  );
$$;

create or replace function private.can_manage_hsq()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select private.is_admin() or private.is_team_leader();
$$;

grant execute on function private.is_team_leader() to authenticated;
grant execute on function private.can_manage_hsq() to authenticated;

-- Team leaders need to read profiles (supervisor dropdown + worker names).
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.is_admin() or private.is_team_leader());

-- ---------------------------------------------------------------------------
-- HSQ daily reports
-- ---------------------------------------------------------------------------
create table if not exists public.hsq_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  site_id text not null,
  location text,
  task_description text not null default 'FTTH',
  prepared_by uuid not null references auth.users (id) on delete restrict,
  prepared_by_name text not null,
  prepared_by_signature text not null,
  supervisor_id uuid references auth.users (id) on delete set null,
  supervisor_name text,
  supervisor_signature text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hsq_daily_reports_status_check
    check (status in ('draft', 'submitted'))
);

create index if not exists hsq_daily_reports_date_idx
  on public.hsq_daily_reports (report_date desc);

create index if not exists hsq_daily_reports_site_date_idx
  on public.hsq_daily_reports (site_id, report_date);

drop trigger if exists hsq_daily_reports_set_updated_at on public.hsq_daily_reports;
create trigger hsq_daily_reports_set_updated_at
  before update on public.hsq_daily_reports
  for each row execute function public.set_updated_at();

create table if not exists public.hsq_report_workers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.hsq_daily_reports (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  worker_name text not null,
  worker_signature text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hsq_report_workers_report_idx
  on public.hsq_report_workers (report_id, sort_order);

alter table public.hsq_daily_reports enable row level security;
alter table public.hsq_report_workers enable row level security;

drop policy if exists hsq_reports_manage on public.hsq_daily_reports;
create policy hsq_reports_manage on public.hsq_daily_reports
  for all to authenticated
  using (private.can_manage_hsq())
  with check (private.can_manage_hsq());

drop policy if exists hsq_workers_manage on public.hsq_report_workers;
create policy hsq_report_workers_manage on public.hsq_report_workers
  for all to authenticated
  using (
    private.can_manage_hsq()
    and exists (
      select 1 from public.hsq_daily_reports r
      where r.id = report_id
    )
  )
  with check (
    private.can_manage_hsq()
    and exists (
      select 1 from public.hsq_daily_reports r
      where r.id = report_id
    )
  );

comment on table public.hsq_daily_reports is
  'Daily Hazard Risk Assessment reports created by team leaders.';
comment on column public.installations.site_id is
  'Worksite identifier entered on installations; used for HSQ worker lookup.';
