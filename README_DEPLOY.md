# Deploy & Test Instructions (ZIP 7)

## 1) Supabase DB migrations

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
```

## 2) Edge function secrets

Set these secrets in Supabase (Project Settings → Edge Functions):

### Required

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### Paymob (billing)

- `PAYMOB_API_KEY`
- `PAYMOB_INTEGRATION_ID`
- `PAYMOB_IFRAME_ID`
- `PAYMOB_HMAC_SECRET`

## 3) Deploy Edge Functions

```bash
supabase functions deploy ingest_channel_message
supabase functions deploy route_agent
supabase functions deploy run_agent
supabase functions deploy extract_order
supabase functions deploy extract_ticket
supabase functions deploy request_handoff
supabase functions deploy release_handoff
supabase functions deploy ingest_kb_source
supabase functions deploy export_workspace_data
supabase functions deploy delete_workspace_data
supabase functions deploy retention_cleanup
supabase functions deploy recompute_usage
supabase functions deploy admin_set_plan_tier

# ZIP 7 billing
supabase functions deploy paymob_create_payment
supabase functions deploy paymob_webhook
```

## 4) Paymob webhook URL

Set Paymob callback URL to:

```
https://<PROJECT_REF>.supabase.co/functions/v1/paymob_webhook
```

Paymob will append `?hmac=...` (or send header) depending on configuration.

## 5) Local test examples

### Start Paymob checkout (dashboard user)

```bash
curl -X POST \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  https://<PROJECT_REF>.supabase.co/functions/v1/paymob_create_payment \
  -d '{
    "workspace_id": "<WORKSPACE_ID>",
    "requested_tier": "paid1",
    "amount_egp": 999,
    "customer": {"first_name":"A","last_name":"B","phone":"01000000000","email":"test@example.com"}
  }'
```

Response returns `iframe_url`.

## 6) Hardening checks

### Frontend tests

```bash
npm install
npm test
```
