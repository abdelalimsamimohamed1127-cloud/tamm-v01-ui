# AI Agent Setup (Tamm)

## 1) Supabase migrations
```bash
supabase db push
```

## 2) Deploy Edge Functions
```bash
supabase functions deploy agent-chat
supabase functions deploy kb-retrain
```

## 3) Set secrets
```bash
supabase secrets set OPENAI_API_KEY=YOUR_KEY
```

Also ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist for kb-retrain (handled by Supabase).

## 4) Run app
```bash
npm install
npm run dev
```

Go to /dashboard/ai-agent
