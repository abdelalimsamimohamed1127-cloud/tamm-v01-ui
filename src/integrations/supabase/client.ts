import { createClient } from '@supabase/supabase-js'

import type { Database } from './types'

type SupabaseCredentials = {
  url: string
  anonKey: string
}

const getSupabaseCredentials = (): SupabaseCredentials => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('Supabase URL is missing or invalid. Please set VITE_SUPABASE_URL.')
  }

  const normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('https://')) {
    throw new Error('Supabase URL must start with https://')
  }

  if (!anonKey || typeof anonKey !== 'string' || anonKey.trim().length === 0) {
    throw new Error('Supabase anon key is missing or invalid. Please set VITE_SUPABASE_ANON_KEY.')
  }

  const normalizedKey = anonKey.trim()

  if (normalizedKey.toLowerCase().includes('service_role')) {
    throw new Error('Supabase anon key must not contain a service role key.')
  }

  const jwtParts = normalizedKey.split('.')
  const hasJwtStructure = jwtParts.length === 3 && jwtParts.every((part) => part.length > 0)
  const isLikelyJwtLength = normalizedKey.length >= 80

  if (!hasJwtStructure || !isLikelyJwtLength) {
    throw new Error('Supabase anon key format is invalid.')
  }

  return { url: normalizedUrl, anonKey: normalizedKey }
}

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials()
const browserStorage = typeof window !== 'undefined' ? window.localStorage : undefined

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: browserStorage,
  },
})

export const isSupabaseConfigured = true
