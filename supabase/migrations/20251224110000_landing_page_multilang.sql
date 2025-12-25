-- 1. Alter landing_sections table to support multi-language content
ALTER TABLE landing_sections
ADD COLUMN translations JSONB;

-- Update existing sections to move content into translations
UPDATE landing_sections
SET translations = jsonb_build_object('en', content)
WHERE content IS NOT NULL;

ALTER TABLE landing_sections
DROP COLUMN content;

-- 2. Alter landing_section_items table to support multi-language content
ALTER TABLE landing_section_items
ADD COLUMN translations JSONB;

-- Update existing items to move content into translations
UPDATE landing_section_items
SET translations = jsonb_build_object('en', metadata)
WHERE metadata IS NOT NULL;

ALTER TABLE landing_section_items
DROP COLUMN metadata;


-- 3. Update seed data to reflect new structure
DO $$
DECLARE
    home_page_id uuid;
    hero_section_id bigint;
    logos_section_id bigint;
BEGIN
    SELECT id INTO home_page_id FROM landing_pages WHERE slug = 'home';

    -- Hero Section
    UPDATE landing_sections
    SET 
        title = 'Hero Section',
        subtitle = 'The first thing users see',
        translations = '{
            "en": {
                "headline": "Build a custom AI social commerce copilot",
                "sub_headline": "Tamm is a no-code platform to build, train, and deploy AI copilots for social commerce.",
                "primary_cta": { "label": "Get Started", "href": "/login" },
                "secondary_cta": { "label": "Book a Demo", "href": "#" }
            },
            "ar": {
                "headline": "أنشئ مساعد تجارة اجتماعية ذكي ومخصص",
                "sub_headline": "منصة Tamm هي منصة بدون كود لبناء وتدريب ونشر مساعدين أذكياء للتجارة الاجتماعية.",
                "primary_cta": { "label": "ابدأ الآن", "href": "/login" },
                "secondary_cta": { "label": "احجز عرضًا توضيحيًا", "href": "#" }
            }
        }'
    WHERE page_id = home_page_id AND key = 'hero';

    -- Logos Section
    UPDATE landing_sections
    SET 
        title = 'Trusted by Logos',
        translations = '{
            "en": { "title": "Trusted by the most innovative companies" },
            "ar": { "title": "موثوق به من قبل أكثر الشركات ابتكارًا" }
        }'
    WHERE page_id = home_page_id AND key = 'logos';

    -- Seed logos
    SELECT id INTO logos_section_id FROM landing_sections WHERE page_id = home_page_id AND key = 'logos';
    IF logos_section_id IS NOT NULL THEN
        -- Clear old items
        DELETE FROM landing_section_items WHERE section_id = logos_section_id;
        -- Insert new items
        INSERT INTO landing_section_items (section_id, title, translations, position)
        VALUES
            (logos_section_id, 'Company 1', '{"en": {"image_url": "/placeholder.svg"}}', 0),
            (logos_section_id, 'Company 2', '{"en": {"image_url": "/placeholder.svg"}}', 1),
            (logos_section_id, 'Company 3', '{"en": {"image_url": "/placeholder.svg"}}', 2),
            (logos_section_id, 'Company 4', '{"en": {"image_url": "/placeholder.svg"}}', 3),
            (logos_section_id, 'Company 5', '{"en": {"image_url": "/placeholder.svg"}}', 4)
        ON CONFLICT DO NOTHING;
    END IF;

END $$;
