// src/services/landing.ts

interface LandingPage {
  id: string;
  slug: string;
  locale: string;
  seo_title: string;
  seo_description: string;
}

interface LandingSection {
  id: string;
  section_key: string;
  content: Record<string, any>; // jsonb content
  order_index: number;
}

interface LandingPricingPlan {
  id: string;
  locale: string;
  plan_key: string;
  name: string;
  price_monthly: number;
  currency: string;
  features: string[]; // Assuming features is a JSONB array of strings
  cta_label: string;
}

export interface LandingData {
  page: LandingPage;
  sections: LandingSection[];
  pricing: LandingPricingPlan[];
}

interface FetchLandingDataArgs {
  slug?: string;
  locale?: string;
}

export async function fetchLandingData({ slug = 'home', locale = 'en' }: FetchLandingDataArgs): Promise<LandingData> {
  const url = new URL(import.meta.env.VITE_SUPABASE_EDGE_FUNCTIONS_URL || 'http://localhost:54321/functions/v1/get-landing');
  url.searchParams.set('slug', slug);
  url.searchParams.set('locale', locale);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(errorBody.message || 'Failed to fetch landing data');
  }

  return response.json();
}
