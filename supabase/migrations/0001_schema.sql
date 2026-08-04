-- Cable Installation Recorder: core schema, roles, and RLS.
-- Applied to the `public` schema unless otherwise noted.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Private schema for SECURITY DEFINER helpers (never exposed via Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
-- Not added to the exposed API schemas, so it is unreachable via PostgREST.
-- authenticated needs USAGE to execute is_admin() inside RLS policies.
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('technician', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.report_frequency as enum ('weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.date_range_mode as enum ('period', 'custom', 'all');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'technician',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Application users with role. Mirrors auth.users.';

-- Create a profile automatically when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'technician'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helper: is_admin() reads the current user's role.
-- SECURITY DEFINER so it can bypass RLS on profiles; lives in private schema
-- so it is never reachable through the Data API (PostgREST).
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function private.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- installations
-- ---------------------------------------------------------------------------
create table if not exists public.installations (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  order_number text not null,
  date_order_received date,
  date_installation date,
  msisdn text,
  fttx_number text,
  customer_phone text,
  customer_address text,
  gps_address text,
  gps_lat text,
  gps_lng text,
  device_serial text,
  network_type text,
  network_box_id text,
  atb_power_readings text,
  cable_length text,
  dead_end text,
  status text not null default 'Pending',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installations_created_by_idx on public.installations (created_by);
create index if not exists installations_created_at_idx on public.installations (created_at desc);
create index if not exists installations_date_installation_idx on public.installations (date_installation);
create index if not exists installations_status_idx on public.installations (status);

drop trigger if exists installations_set_updated_at on public.installations;
create trigger installations_set_updated_at
  before update on public.installations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- installation_images
-- ---------------------------------------------------------------------------
create table if not exists public.installation_images (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.installations (id) on delete cascade,
  slot text not null,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists installation_images_installation_idx
  on public.installation_images (installation_id);

-- ---------------------------------------------------------------------------
-- report_schedules
-- ---------------------------------------------------------------------------
create table if not exists public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  frequency public.report_frequency not null default 'weekly',
  day_of_week int check (day_of_week between 0 and 6),   -- 0=Sunday, for weekly
  day_of_month int check (day_of_month between 1 and 28), -- for monthly
  send_hour int not null default 6 check (send_hour between 0 and 23), -- UTC
  recipients text[] not null default '{}',
  date_range_mode public.date_range_mode not null default 'period',
  custom_from date,
  custom_to date,
  status_filter text,
  active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- report_runs (audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.report_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.report_schedules (id) on delete set null,
  ran_at timestamptz not null default now(),
  period_from date,
  period_to date,
  recipient_count int not null default 0,
  pdf_path text,
  status text not null default 'success',
  error text
);

create index if not exists report_runs_schedule_idx on public.report_runs (schedule_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.installations enable row level security;
alter table public.installation_images enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_runs enable row level security;

-- profiles: users read their own; admins read all. Users update their own
-- full_name (not role). Admins update any (including role).
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or private.is_admin())
  with check (id = auth.uid() or private.is_admin());

-- installations: all authenticated users can read; owners + admins can write.
drop policy if exists installations_select_all on public.installations;
create policy installations_select_all on public.installations
  for select to authenticated
  using (true);

drop policy if exists installations_insert_own on public.installations;
create policy installations_insert_own on public.installations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists installations_update_own on public.installations;
create policy installations_update_own on public.installations
  for update to authenticated
  using (created_by = auth.uid() or private.is_admin())
  with check (created_by = auth.uid() or private.is_admin());

drop policy if exists installations_delete_own on public.installations;
create policy installations_delete_own on public.installations
  for delete to authenticated
  using (created_by = auth.uid() or private.is_admin());

-- installation_images: read all; write when you can write the parent install.
drop policy if exists images_select_all on public.installation_images;
create policy images_select_all on public.installation_images
  for select to authenticated
  using (true);

drop policy if exists images_insert_owner on public.installation_images;
create policy images_insert_owner on public.installation_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.installations i
      where i.id = installation_id
        and (i.created_by = auth.uid() or private.is_admin())
    )
  );

drop policy if exists images_delete_owner on public.installation_images;
create policy images_delete_owner on public.installation_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.installations i
      where i.id = installation_id
        and (i.created_by = auth.uid() or private.is_admin())
    )
  );

-- report_schedules / report_runs: admin only.
drop policy if exists schedules_admin_all on public.report_schedules;
create policy schedules_admin_all on public.report_schedules
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists runs_admin_select on public.report_runs;
create policy runs_admin_select on public.report_runs
  for select to authenticated
  using (private.is_admin());

-- ---------------------------------------------------------------------------
-- Table privileges for the PostgREST API roles.
-- RLS (above) governs which ROWS are visible; these GRANTs govern table
-- access. `anon` gets nothing here (all app access requires authentication).
-- `service_role` bypasses RLS and already has full privileges.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.installations,
  public.installation_images,
  public.report_schedules,
  public.report_runs
  to authenticated;

grant select, update on public.profiles to authenticated;

-- service_role bypasses RLS but still needs table GRANTs. The generate-report
-- Edge Function uses service_role to read installations/images and write runs.
grant all on
  public.profiles,
  public.installations,
  public.installation_images,
  public.report_schedules,
  public.report_runs
  to service_role;
