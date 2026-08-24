# Deploy frontend on Infomaniak (Supabase backend)

Host the **Next.js app** on Infomaniak Node.js. Keep **Supabase** for Auth, DB, Storage, and report Edge Functions.

GitHub repo: `https://github.com/devhammond-ops/siterecorder.git`

## 1. Create the Node.js site

1. Open [Infomaniak Manager](https://manager.infomaniak.com) → your **Web Hosting** product.
2. **Add a site** → **Node.js**.
3. Choose **Custom method** → import from **GitHub**:
   - Repo: `devhammond-ops/siterecorder`
   - Branch: `main`
4. Suggested settings:

| Setting | Value |
|---------|--------|
| Node.js version | **20** or **22** (prefer 22 if available) |
| Package manager | npm |
| Execution folder | project root (where `package.json` is) |
| Install / build | `npm install && npm run build` |
| Start / run | `npm start` |
| Listening port | Use the port Infomaniak assigns (often `3000`). Must match Manager **and** `PORT`. |

`npm start` runs `next start --hostname 0.0.0.0`. Next.js reads Infomaniak’s `PORT` env automatically.

5. Save, run **Build**, then **Start** the application. Watch the console for errors.

## 2. Environment variables (Infomaniak site settings)

Copy from your working local `.env.local` (do **not** commit these):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=
REPORT_FROM_EMAIL=reports@yourdomain.com
```

After changing env vars, **restart** the Node.js app.

## 3. Domain + SSL

1. In Manager, attach your domain to the Node.js site.
2. Enable **SSL** (Let’s Encrypt).
3. Note the public URL, e.g. `https://recorder.yourdomain.com`.

## 4. Supabase Auth URLs (required after go-live)

**Authentication → URL Configuration**:

- **Site URL**: `https://your-production-domain.com`
- **Redirect URLs**: add `https://your-production-domain.com/**`  
  Keep `http://localhost:3000/**` if you still develop locally.

## 5. Smoke test

1. Open the production URL → sign in.
2. Create an installation and upload a photo.
3. Export Excel / PDF.
4. (Optional later) Deploy Edge Function + Vault/cron for scheduled emails — not required for basic use.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Build fails | Console logs; Node 20/22; `npm install && npm run build` locally |
| App won’t start | Port in Manager matches `PORT`; start command is `npm start` |
| Auth Failed to fetch | `NEXT_PUBLIC_SUPABASE_URL` resolves in browser (`/auth/v1/health`); Auth Site URL is your HTTPS domain |
| Images fail | Supabase Storage buckets + RLS from migrations; service role / signed URLs |

## What stays on Supabase

- Database, Auth, Storage
- `generate-report` Edge Function + Resend secrets
- Vault secrets + `pg_cron` hourly job (scheduled PDF reports)
