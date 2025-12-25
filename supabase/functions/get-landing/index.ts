import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { slug, lang } = await req.json();
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: page, error: pageError } = await supabase
      .from('landing_pages')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (pageError) throw pageError;

    const { data: sections, error: sectionsError } = await supabase
      .from('landing_sections')
      .select(`
        key,
        translations,
        items:landing_section_items (
          title,
          translations
        )
      `)
      .eq('page_id', page.id)
      .eq('is_enabled', true)
      .eq('status', 'published')
      .order('position');

    if (sectionsError) throw sectionsError;

    const processedSections = sections.map(section => {
      const content = section.translations[lang] || section.translations['en'];
      const items = section.items.map(item => {
        const itemContent = item.translations[lang] || item.translations['en'];
        return {
          ...itemContent,
          title: item.title
        }
      });

      return {
        key: section.key,
        ...content,
        items
      };
    });

    return new Response(JSON.stringify(processedSections), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
