# Cable Installation Recorder

A responsive web app for a telecom company to track and record internet cable
installations. Technicians capture customer information and structured photo
evidence per installation; admins configure automated PDF email reports and
export customer data to Excel.

## Features

- Role-based access (technician / admin) via Supabase Auth
- Create / edit / delete installation records (one customer per row)
- Fixed, labeled photo-evidence slots matching the field form (Before/After,
  Anchoring Point, ONT, PPE on pole, Power Meter, Acceptance Form, etc.)
- Detail view: customer info at the top, image evidence in a responsive grid
- Add / delete photos when editing an entry
- Dashboard with search + status + install-date filters
- Export customer information only (no images) to Excel (`.xlsx`)
- Admin-configurable scheduled PDF reports (weekly/monthly) emailed via Resend,
  with a configurable recipient list and date-range/status filters
- Hourly `pg_cron` job that invokes the report Edge Function, which decides
  which schedules are due

## Tech stack

- Next.js (App Router, TypeScript), Tailwind CSS
- Supabase: Postgres, Auth, Storage, Edge Functions, `pg_cron` + `pg_net`
- `exceljs` (Excel), `pdf-lib` (PDF, in the Edge Function), Resend (email)

## Prerequisites

- Node.js 18.18+ (or 20+)
- A Supabase project (cloud) or the Supabase CLI + Docker for local dev
- A Resend account + verified sending domain (for report emails)

## 1. Install

```bash
npm install
```

## 2. Environment

Copy the example env file and fill in values:

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: from your
  Supabase project API settings (use the publishable/anon key).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only; used by the Excel route and to
  invoke the Edge Function for test runs. Never expose to the browser.
- `RESEND_API_KEY` / `REPORT_FROM_EMAIL`: used by the Edge Function.

## 3. Database schema

Apply the migrations in `supabase/migrations` (in order):

- `0001_schema.sql` - tables, roles, RLS policies, triggers
- `0002_storage.sql` - `installation-images` and `reports` buckets + policies
- `0003_cron.sql` - hourly `pg_cron` job that pings the Edge Function

Using the Supabase CLI (linked to your project):

```bash
supabase db push
```

Or paste each file into the Supabase SQL editor.

### Set the first admin

New users default to the `technician` role. Promote your first admin once:

```sql
update public.profiles set role = 'admin' where id = '<your-user-uuid>';
```

After that, admins can manage roles from the in-app Users page.

## 4. Storage

The buckets are created by `0002_storage.sql`. Both are private; images are
served through short-lived signed URLs generated server-side.

## 5. Edge Function

Deploy the report generator and set its secrets:

```bash
supabase functions deploy generate-report --no-verify-jwt

supabase secrets set \
  RESEND_API_KEY=your-resend-api-key \
  REPORT_FROM_EMAIL=reports@yourdomain.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in the
Edge Function runtime.

### Enable the cron job

`0003_cron.sql` reads the project URL and service role key from Supabase Vault.
Create those secrets once (values are project-specific):

```sql
select vault.create_secret('https://YOUR-REF.supabase.co', 'project_url');
select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
```

The job runs hourly (minute 5, UTC). The Edge Function determines which
schedules are due based on frequency, day, `send_hour`, and `last_run_at`, so
schedules stay fully configurable from the admin UI without editing cron.

## 6. Run

```bash
npm run dev
```

Open http://localhost:3000, sign up, promote yourself to admin (see above), and
start recording installations.

## Reports

Admins manage schedules under **Reports**. Each schedule has:

- Frequency (weekly/monthly), day, and send hour (UTC)
- Recipient email list
- Contents: only new installations in the period, a custom install-date range,
  or all installations
- Optional status filter

Use **Send test** to generate and email a report immediately without waiting
for the schedule.

## Project structure

```
src/
  app/
    (app)/                 authenticated routes (dashboard, installations, admin)
    api/export/excel/      Excel export route
    api/reports/run/       admin test-run trigger
    login/                 auth
  components/              UI + feature components
  lib/                     supabase clients, auth, constants, helpers
supabase/
  migrations/              SQL schema, storage, cron
  functions/generate-report/  PDF + email Edge Function
```
