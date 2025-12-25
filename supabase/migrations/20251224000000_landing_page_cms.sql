CREATE TABLE landing_page_sections (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    section_type TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for landing_page_sections
ALTER TABLE landing_page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON landing_page_sections
    FOR SELECT
    USING (is_enabled = true);

CREATE POLICY "Allow admin full access" ON landing_page_sections
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_landing_page_sections_updated
    BEFORE UPDATE ON landing_page_sections
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Seed data
INSERT INTO landing_page_sections (section_type, sort_order, content)
VALUES 
('hero', 0, '{
    "headline": "Build a custom AI social commerce copilot",
    "sub_headline": "Tamm is a no-code platform to build, train, and deploy AI copilots for social commerce.",
    "primary_cta_text": "Get Started",
    "primary_cta_link": "/login",
    "secondary_cta_text": "Book a Demo",
    "secondary_cta_link": "#"
}'),
('logos', 1, '{
    "title": "Trusted by the most innovative companies",
    "logos": [
        {"name": "Company 1", "image_url": "/logo1.svg"},
        {"name": "Company 2", "image_url": "/logo2.svg"},
        {"name": "Company 3", "image_url": "/logo3.svg"},
        {"name": "Company 4", "image_url": "/logo4.svg"},
        {"name": "Company 5", "image_url": "/logo5.svg"}
    ]
}');
