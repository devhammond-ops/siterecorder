-- Optional free-text comments on installations.

alter table public.installations
  add column if not exists comments text,
  add column if not exists status_comments text;

comment on column public.installations.comments is
  'General notes entered before photo uploads.';
comment on column public.installations.status_comments is
  'Notes about the installation status.';
