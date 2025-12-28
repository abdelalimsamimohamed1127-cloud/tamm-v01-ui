// src/env.ts

if (!import.meta.env.VITE_SUPABASE_URL) {
  throw new Error("Missing VITE_SUPABASE_URL environment variable.");
}

if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_ANON_KEY environment variable.");
}

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY;
