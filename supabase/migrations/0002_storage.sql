-- Storage buckets and access policies.
-- installation-images: private bucket holding evidence photos.
-- reports: private bucket holding generated PDF reports.

insert into storage.buckets (id, name, public)
values ('installation-images', 'installation-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Image paths are laid out as: <installation_id>/<slot>-<timestamp>.<ext>
-- Authenticated users may read all evidence images.
drop policy if exists "images read" on storage.objects;
create policy "images read" on storage.objects
  for select to authenticated
  using (bucket_id = 'installation-images');

-- Insert allowed when the user owns (or admins) the parent installation.
drop policy if exists "images insert" on storage.objects;
create policy "images insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'installation-images'
    and exists (
      select 1 from public.installations i
      where i.id = ((storage.foldername(name))[1])::uuid
        and (i.created_by = auth.uid() or private.is_admin())
    )
  );

-- Update (needed for upsert) with the same ownership rule.
drop policy if exists "images update" on storage.objects;
create policy "images update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'installation-images'
    and exists (
      select 1 from public.installations i
      where i.id = ((storage.foldername(name))[1])::uuid
        and (i.created_by = auth.uid() or private.is_admin())
    )
  );

drop policy if exists "images delete" on storage.objects;
create policy "images delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'installation-images'
    and exists (
      select 1 from public.installations i
      where i.id = ((storage.foldername(name))[1])::uuid
        and (i.created_by = auth.uid() or private.is_admin())
    )
  );

-- reports bucket: only admins may read via client; the Edge Function uses the
-- service role and bypasses these policies.
drop policy if exists "reports read admin" on storage.objects;
create policy "reports read admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'reports' and private.is_admin());
