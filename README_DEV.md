# Tamm — Developer Setup & Contracts

## Project scope
- Frontend: Vite + React + TypeScript
- Backend: Supabase
- Channels: Webchat, WhatsApp, Messenger
- Stage: Platform Stabilization (Stage 0)

## Environment variables
- Required:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Forbidden on frontend: service role key, admin secrets
- App must fail fast if configuration is missing or invalid

## .env.example
```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Local run
```bash
npm install
npm run dev
```

## Supabase contract
- Only anon key is used client-side
- RLS is enforced on all data access
- `workspace_id` is mandatory for every request
- No direct admin access from the app

## Smoke checklist (run before every commit)
- App boots without errors
- Login works
- Workspace loads
- `/dashboard` routes work
- Refresh on deep route works
- Browser console has no warnings or errors
