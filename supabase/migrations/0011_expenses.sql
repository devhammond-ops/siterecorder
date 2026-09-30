-- Expenses: user-raised expense claims with optional receipt images.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_created_by_idx on public.expenses (created_by);
create index if not exists expenses_expense_date_idx on public.expenses (expense_date desc);

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create table if not exists public.expense_images (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists expense_images_expense_idx
  on public.expense_images (expense_id, created_at);

alter table public.expenses enable row level security;
alter table public.expense_images enable row level security;

-- Users manage their own expenses; admins manage all.
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (created_by = auth.uid() or private.is_admin());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using (created_by = auth.uid() or private.is_admin())
  with check (created_by = auth.uid() or private.is_admin());

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (created_by = auth.uid() or private.is_admin());

drop policy if exists expense_images_manage on public.expense_images;
create policy expense_images_manage on public.expense_images
  for all to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (e.created_by = auth.uid() or private.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (e.created_by = auth.uid() or private.is_admin())
    )
  );

grant select, insert, update, delete on public.expenses, public.expense_images to authenticated;
grant all on public.expenses, public.expense_images to service_role;

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

-- Paths: <expense_id>/<timestamp>.<ext>
drop policy if exists "expense receipts read" on storage.objects;
create policy "expense receipts read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expenses e
      where e.id = ((storage.foldername(name))[1])::uuid
        and (e.created_by = auth.uid() or private.is_admin())
    )
  );

drop policy if exists "expense receipts insert" on storage.objects;
create policy "expense receipts insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expenses e
      where e.id = ((storage.foldername(name))[1])::uuid
        and (e.created_by = auth.uid() or private.is_admin())
    )
  );

drop policy if exists "expense receipts update" on storage.objects;
create policy "expense receipts update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expenses e
      where e.id = ((storage.foldername(name))[1])::uuid
        and (e.created_by = auth.uid() or private.is_admin())
    )
  );

drop policy if exists "expense receipts delete" on storage.objects;
create policy "expense receipts delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'expense-receipts'
    and exists (
      select 1 from public.expenses e
      where e.id = ((storage.foldername(name))[1])::uuid
        and (e.created_by = auth.uid() or private.is_admin())
    )
  );

comment on table public.expenses is
  'User-raised expense claims with date, description, and amount.';
comment on table public.expense_images is
  'Receipt or invoice images attached to an expense.';
