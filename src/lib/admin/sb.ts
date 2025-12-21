import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase client casted to `any` so admin code can query admin-only tables
 * (e.g. user_roles, subscriptions, audit_logs) without breaking generated DB types.
 *
 * TODO: regenerate Database types after applying admin SQL migrations.
 */
export const sb = supabase as any;
