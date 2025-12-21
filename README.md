# Tamm — AI

This repository is the **final merged** for:
- **Core runtime** (agents, channels, conversations, messages)
- **Webchat** channel end-to-end (ingestion → AI reply → handoff hard stop)
- **RAG** (PDF/DOCX/CSV/TXT ingest + pgvector retrieval)
- **Orders & Tickets** auto-extraction
- **Inbox** (human replies + AI draft suggestions during handoff)
- **Usage metering + plan gating** (UI + Edge + DB triggers)
- **Admin panel** (tamm_admins guard) + upgrade request approvals
- **Paymob billing** (subscriptions + invoices + webhook)
- **Hardening**: rate limiting, audit logs, tests scaffold

> LLM runtime is locked to **GPT-4o-mini** server-side.

---

## 0) Prerequisites

- Node.js 18+ (or 20+ recommended)
- Supabase CLI installed and logged in
- A Supabase project
- OpenAI API key
- (Optional) Paymob merchant account + integration ids

---

## 1) Frontend env vars

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Run:

```bash
npm install
npm run dev
```

---

## 2) Supabase: link + migrate

From repo root:

```bash
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

---

## 3) Supabase Edge secrets (required)

In Supabase Dashboard → **Project Settings → Edge Functions → Secrets**:

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

If you use Paymob:
- `PAYMOB_API_KEY`
- `PAYMOB_INTEGRATION_ID`
- `PAYMOB_IFRAME_ID`
- `PAYMOB_HMAC_SECRET` (recommended; if you don't have it, webhook will still log events but signature verification may be skipped)

---

## 4) Deploy Edge Functions

Deploy the core runtime:

```bash
supabase functions deploy ingest_channel_message
supabase functions deploy route_agent
supabase functions deploy run_agent
supabase functions deploy request_handoff
supabase functions deploy release_handoff
supabase functions deploy ingest_kb_source
```

Inbox + privacy:

```bash
supabase functions deploy generate_draft
supabase functions deploy send_draft_message
supabase functions deploy export_workspace_data
supabase functions deploy delete_workspace_data
```

Usage + plans + admin:

```bash
supabase functions deploy recompute_usage
supabase functions deploy admin_set_plan_tier
supabase functions deploy retention_cleanup
```

Paymob:

```bash
supabase functions deploy paymob_create_payment
supabase functions deploy paymob_webhook
```

---

## 5) Quick end-to-end test (curl)

### 5.1 Ingest a message (webchat / playground)

```bash
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/ingest_channel_message"   -H "Authorization: Bearer <ACCESS_TOKEN>"   -H "Content-Type: application/json"   -d '{
    "workspace_id":"<WORKSPACE_UUID>",
    "channel_id":"<WEBCHAT_CHANNEL_UUID>",
    "external_user_id":"demo_user_1",
    "text":"عايز اطلب منتج وسعره كام؟",
    "metadata":{"source":"curl"}
  }'
```

Expected:
- Returns `{ reply, conversation_id, message_id }`
- Creates an **Order** with `status = pending_confirmation` for sales-like intent
- Creates a **Ticket** with `status = open` for complaint/support intent

### 5.2 Upload KB source (PDF/DOCX/CSV/TXT)

```bash
curl -s -X POST "https://<project-ref>.supabase.co/functions/v1/ingest_kb_source"   -H "Authorization: Bearer <ACCESS_TOKEN>"   -F "workspace_id=<WORKSPACE_UUID>"   -F "source_type=file"   -F "title=Policies"   -F "file=@./policies.pdf"
```

---

## 6) Handoff behavior (hard stop)

When the user requests a human (Arabic/English triggers), the conversation becomes `handoff`.
- **AI replies stop** for that conversation.
- Your team can reply as **human** from Inbox.
- You can still generate **draft suggestions** using `generate_draft`, and then **send** them using `send_draft_message`.

---

## 7) Admin setup (tamm_admins)

To make a user a Tamm admin, insert their `auth.users.id` into `public.tamm_admins`.

Example (SQL editor):

```sql
insert into public.tamm_admins (user_id) values ('<USER_UUID>')
on conflict (user_id) do nothing;
```

Admin-only functions:
- `admin_set_plan_tier`
- `retention_cleanup`
- Paymob webhook processing (logs everything; tier changes happen based on your mapping)

---

## 8) Paymob setup (webhook + checkout)

Webhook URL (set inside Paymob dashboard):

```
https://<project-ref>.supabase.co/functions/v1/paymob_webhook
```

Checkout flow:
- Client calls `paymob_create_payment` with workspace + tier
- Function returns an iframe URL (or payment key) to open Paymob checkout
- Webhook marks invoice paid + applies tier to the workspace

> Pricing mapping and tier application logic can be adjusted in the billing helpers in the repo.

---

## 9) Tests

```bash
npm test
```

---

## Notes

- RLS is enabled on all client-facing tables and enforces workspace isolation via:
  `public.is_workspace_member(workspace_id)`
- Provider abstraction exists server-side; OpenAI is enabled now.
- Model for chat is locked to `gpt-4o-mini`.


---

# ZIP 12 Merge Additions (Evals + Insights)

## 1) New migration

```bash
supabase db push
```


## 3) UI pages

- `/dashboard/evals` → shows traces + citations + thumbs up/down feedback
- `/dashboard/insights` → generates a weekly report + stores it in DB
