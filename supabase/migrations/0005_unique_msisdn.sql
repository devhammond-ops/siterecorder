-- Enforce one installation per MSISDN and remove existing duplicates (keep oldest row).

-- Drop duplicate rows sharing the same MSISDN (normalized), keeping the earliest created.
delete from public.installations a
using public.installations b
where a.msisdn is not null
  and trim(a.msisdn) <> ''
  and lower(trim(a.msisdn)) = lower(trim(b.msisdn))
  and a.created_at > b.created_at;

create unique index if not exists installations_msisdn_unique
  on public.installations (lower(trim(msisdn)))
  where msisdn is not null and trim(msisdn) <> '';

comment on index public.installations_msisdn_unique is
  'Each MSISDN may appear on at most one installation record.';
