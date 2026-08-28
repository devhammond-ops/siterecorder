-- User profile: technician phone number for contact on records.

alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is 'Technician contact phone (editable on profile page).';
