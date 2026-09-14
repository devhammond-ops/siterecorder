-- HSQ rework: location-first, interactive risk score, visitors, PPE checklist.
-- Drop site_id from HSQ reports (installations.site_id is unchanged / optional).

alter table public.hsq_daily_reports
  alter column site_id drop not null;

alter table public.hsq_daily_reports
  drop column if exists site_id;

alter table public.hsq_daily_reports
  add column if not exists risk_probability int
    check (risk_probability is null or risk_probability between 1 and 5),
  add column if not exists risk_severity int
    check (risk_severity is null or risk_severity between 1 and 5),
  add column if not exists risk_score int
    check (risk_score is null or risk_score between 1 and 25),
  add column if not exists ppe_checklist jsonb not null default '{}'::jsonb;

comment on column public.hsq_daily_reports.risk_probability is
  'Selected probability 1-5 for interactive risk matrix.';
comment on column public.hsq_daily_reports.risk_severity is
  'Selected severity 1-5 for interactive risk matrix.';
comment on column public.hsq_daily_reports.risk_score is
  'Probability x Severity (1-25).';
comment on column public.hsq_daily_reports.ppe_checklist is
  'One PPE inspection checklist per report (item answers JSON).';

-- Location becomes the primary site identifier for HSQ.
update public.hsq_daily_reports
set location = coalesce(nullif(trim(location), ''), 'Unknown')
where location is null or trim(location) = '';

alter table public.hsq_daily_reports
  alter column location set not null;

create table if not exists public.hsq_report_visitors (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.hsq_daily_reports (id) on delete cascade,
  visitor_name text not null,
  visitor_signature text,
  visit_time text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hsq_report_visitors_report_idx
  on public.hsq_report_visitors (report_id, sort_order);

alter table public.hsq_report_visitors enable row level security;

drop policy if exists hsq_report_visitors_manage on public.hsq_report_visitors;
create policy hsq_report_visitors_manage on public.hsq_report_visitors
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

grant select, insert, update, delete on public.hsq_report_visitors to authenticated;
grant all on public.hsq_report_visitors to service_role;

-- Ensure HSQ tables are granted (idempotent for older installs).
grant select, insert, update, delete on
  public.hsq_daily_reports,
  public.hsq_report_workers
  to authenticated;

grant all on
  public.hsq_daily_reports,
  public.hsq_report_workers
  to service_role;
