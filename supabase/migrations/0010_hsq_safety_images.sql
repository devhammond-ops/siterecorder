-- HSQ safety photos: table + private storage bucket.

create table if not exists public.hsq_report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.hsq_daily_reports (id) on delete cascade,
  slot text not null default 'safety',
  storage_path text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hsq_report_images_report_idx
  on public.hsq_report_images (report_id, created_at);

alter table public.hsq_report_images enable row level security;

drop policy if exists hsq_report_images_manage on public.hsq_report_images;
create policy hsq_report_images_manage on public.hsq_report_images
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

grant select, insert, update, delete on public.hsq_report_images to authenticated;
grant all on public.hsq_report_images to service_role;

insert into storage.buckets (id, name, public)
values ('hsq-images', 'hsq-images', false)
on conflict (id) do nothing;

-- Paths: <report_id>/<slot>-<timestamp>.<ext>
drop policy if exists "hsq images read" on storage.objects;
create policy "hsq images read" on storage.objects
  for select to authenticated
  using (bucket_id = 'hsq-images' and private.can_manage_hsq());

drop policy if exists "hsq images insert" on storage.objects;
create policy "hsq images insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hsq-images'
    and private.can_manage_hsq()
    and exists (
      select 1 from public.hsq_daily_reports r
      where r.id = ((storage.foldername(name))[1])::uuid
    )
  );

drop policy if exists "hsq images update" on storage.objects;
create policy "hsq images update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'hsq-images'
    and private.can_manage_hsq()
    and exists (
      select 1 from public.hsq_daily_reports r
      where r.id = ((storage.foldername(name))[1])::uuid
    )
  );

drop policy if exists "hsq images delete" on storage.objects;
create policy "hsq images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hsq-images'
    and private.can_manage_hsq()
    and exists (
      select 1 from public.hsq_daily_reports r
      where r.id = ((storage.foldername(name))[1])::uuid
    )
  );

comment on table public.hsq_report_images is
  'Safety / evidence photos attached to an HSQ daily report.';
