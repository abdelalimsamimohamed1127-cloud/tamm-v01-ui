# Tamm UI — Dev Quickstart (Stage 0)

## Required environment
- `VITE_SUPABASE_URL` – your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – your Supabase anon public key

Create a `.env.local` (or export vars in your shell) before running the app.

## Install & run
```bash
npm install
npm run dev
```

## Supabase CLI (no secrets committed)
```bash
# Link to your Supabase project (prompts for access token)
supabase link --project-ref <your-project-ref>

# Push database migrations
supabase db push

# Deploy Edge Functions (used in later stages)
supabase functions deploy
```

## Stage 0 smoke checklist
- `npm run dev` starts without crashing
- Login screen loads (auth flows work when env vars are set)
- `/dashboard/ai-agent` loads and stays on refresh
- `/dashboard/channels` loads and stays on refresh
- Refreshing any `/dashboard/*` route keeps the same path
