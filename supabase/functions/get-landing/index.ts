import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role key

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') || 'home';
    let locale = url.searchParams.get('locale') || 'en';

    // Validate locale
    if (!['en', 'ar'].includes(locale)) {
      locale = 'en'; // Default to English if invalid locale is provided
    }

    // Create a Supabase client with the service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch landing_pages data
    const { data: pageData, error: pageError } = await supabase
      .from('landing_pages')
      .select('id, slug, locale, seo_title, seo_description')
      .eq('slug', slug)
      .eq('locale', locale)
      .limit(1)
      .single();

    if (pageError || !pageData) {
      if (pageError?.code === 'PGRST116') { // No rows found
        return new Response(JSON.stringify({ message: 'Landing page not found for the given slug and locale.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      console.error('Error fetching landing page:', pageError);
      return new Response(JSON.stringify({ message: 'Failed to fetch landing page data.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch related landing_sections
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('landing_sections')
      .select('id, section_key, content, order_index')
      .eq('page_id', pageData.id)
      .order('order_index', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching landing sections:', sectionsError);
      return new Response(JSON.stringify({ message: 'Failed to fetch landing sections.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch landing_pricing data
    const { data: pricingData, error: pricingError } = await supabase
      .from('landing_pricing')
      .select('id, plan_key, name, price_monthly, currency, features, cta_label')
      .eq('locale', locale)
      .order('price_monthly', { ascending: true });

    if (pricingError) {
      console.error('Error fetching landing pricing:', pricingError);
      return new Response(JSON.stringify({ message: 'Failed to fetch landing pricing data.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Normalize the payload
    const payload = {
      page: pageData,
      sections: sectionsData,
      pricing: pricingData,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(JSON.stringify({ message: 'An unexpected error occurred.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
