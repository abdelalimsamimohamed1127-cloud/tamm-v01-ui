-- 1. Create landing_pages table
CREATE TABLE IF NOT EXISTS landing_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create landing_sections table
CREATE TABLE IF NOT EXISTS landing_sections (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    page_id uuid NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    content JSONB,
    position INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(page_id, key)
);

-- 3. Create landing_section_items table
CREATE TABLE IF NOT EXISTS landing_section_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    section_id BIGINT NOT NULL REFERENCES landing_sections(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    icon TEXT,
    metadata JSONB,
    position INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RLS Policies
-- landing_pages
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on landing_pages" ON landing_pages;
CREATE POLICY "Allow public read access on landing_pages" ON landing_pages FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Allow admin full access on landing_pages" ON landing_pages;
CREATE POLICY "Allow admin full access on landing_pages" ON landing_pages FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- landing_sections
ALTER TABLE landing_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on landing_sections" ON landing_sections;
CREATE POLICY "Allow public read access on landing_sections" ON landing_sections FOR SELECT USING (
    is_enabled = true AND status = 'published' AND page_id IN (SELECT id FROM landing_pages WHERE is_active = true)
);
DROP POLICY IF EXISTS "Allow admin full access on landing_sections" ON landing_sections;
CREATE POLICY "Allow admin full access on landing_sections" ON landing_sections FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- landing_section_items
ALTER TABLE landing_section_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on landing_section_items" ON landing_section_items;
CREATE POLICY "Allow public read access on landing_section_items" ON landing_section_items FOR SELECT USING (
    is_enabled = true AND section_id IN (
        SELECT ls.id FROM landing_sections ls
        JOIN landing_pages lp ON ls.page_id = lp.id
        WHERE ls.is_enabled = true AND ls.status = 'published' AND lp.is_active = true
    )
);
DROP POLICY IF EXISTS "Allow admin full access on landing_section_items" ON landing_section_items;
CREATE POLICY "Allow admin full access on landing_section_items" ON landing_section_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 5. Triggers for updated_at
DROP FUNCTION IF EXISTS handle_updated_at();
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_landing_pages_updated ON landing_pages;
CREATE TRIGGER on_landing_pages_updated
    BEFORE UPDATE ON landing_pages
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS on_landing_sections_updated ON landing_sections;
CREATE TRIGGER on_landing_sections_updated
    BEFORE UPDATE ON landing_sections
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS on_landing_section_items_updated ON landing_section_items;
CREATE TRIGGER on_landing_section_items_updated
    BEFORE UPDATE ON landing_section_items
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- 6. Seed Data
-- Insert landing page
INSERT INTO landing_pages (slug, title) VALUES ('home', 'Tamm Home Page') ON CONFLICT (slug) DO NOTHING;

-- Insert sections
DO $$
DECLARE
    home_page_id uuid;
    hero_section_id bigint;
    logos_section_id bigint;
BEGIN
    SELECT id INTO home_page_id FROM landing_pages WHERE slug = 'home';

    -- Hero Section
    INSERT INTO landing_sections (page_id, key, title, subtitle, content, position)
    VALUES (home_page_id, 'hero', 'Build a custom AI social commerce copilot', 'Tamm is a no-code platform to build, train, and deploy AI copilots for social commerce.', '{
        "primary_cta": { "label": "Get Started", "href": "/login" },
        "secondary_cta": { "label": "Book a Demo", "href": "#" }
    }', 0) ON CONFLICT (page_id, key) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, content = EXCLUDED.content RETURNING id INTO hero_section_id;

    -- Logos Section
    INSERT INTO landing_sections (page_id, key, title, position)
    VALUES (home_page_id, 'logos', 'Trusted by the most innovative companies', 1) ON CONFLICT (page_id, key) DO UPDATE SET title = EXCLUDED.title RETURNING id INTO logos_section_id;

    -- Seed logos
    IF logos_section_id IS NOT NULL THEN
        INSERT INTO landing_section_items (section_id, title, metadata, position)
        VALUES
            (logos_section_id, 'Company 1', '{"image_url": "/logo1.svg"}', 0),
            (logos_section_id, 'Company 2', '{"image_url": "/logo2.svg"}', 1),
            (logos_section_id, 'Company 3', '{"image_url": "/logo3.svg"}', 2),
            (logos_section_id, 'Company 4', '{"image_url": "/logo4.svg"}', 3),
            (logos_section_id, 'Company 5', '{"image_url": "/logo5.svg"}', 4)
        ON CONFLICT DO NOTHING;
    END IF;

END $$;
