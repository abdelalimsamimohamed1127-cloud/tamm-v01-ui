# Tamm Admin Panel (Setup)

## 1) Enable Admin Access (RBAC)
This repo includes an admin panel at:

- `/admin`

Admin access is checked via:

1) `VITE_ADMIN_EMAILS` (comma-separated) **for development**
2) `public.user_roles` table (**recommended for production**)

### Dev shortcut
Add to your `.env`:

```
VITE_ADMIN_EMAILS=you@example.com,another@example.com
```

## 2) Apply DB Migrations
Open Supabase SQL editor and run:

`supabase/migrations/20251218_admin.sql`

This creates:
- `user_roles`
- `subscriptions`
- `usage_events`
- `audit_logs`
- helper functions `is_admin()` and `is_workspace_member()`
- RLS policies

## 3) Add Yourself as Admin
After migrations:

```sql
insert into public.user_roles (user_id, role)
values ('<YOUR_AUTH_USER_UUID>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

## 4) Stripe (optional, next stage)
This build includes the billing UI and `subscriptions` table, but you still need:
- a Stripe webhook edge function (next step)
- Stripe dashboard webhook setup

## 5) Run
```
npm install
npm run dev
```


## Scheduled retention cleanup (recommended)

Run `retention_cleanup` daily using Supabase Scheduled Triggers (or any external cron).

Example (daily at 02:00 UTC): call the Edge Function with a Tamm admin JWT.

- Function: `retention_cleanup`
- Auth: Bearer token for a user in `tamm_admins`

This calls `public.run_retention_cleanup()` which uses `workspace_settings.retention_days` when set, otherwise defaults by plan tier:
- free: 30 days
- paid1: 180 days
- paid2: 365 days
- paid3: 1095 days
