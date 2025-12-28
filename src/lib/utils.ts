import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client"; // Import supabase client

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}
