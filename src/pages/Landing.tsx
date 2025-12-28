import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchLandingData, LandingData } from '@/services/landing'; // Import the new service
import HeroSection from '@/components/landing/HeroSection';
import LogosSection from '@/components/landing/LogosSection';
import PricingSection from '@/components/landing/PricingSection'; // Import the new PricingSection
import { Skeleton } from '@/components/ui/skeleton'; // Assuming a Skeleton component exists for loading states

// Define a type for a section to be rendered. This allows for dynamic content.
interface LandingPageSection {
  id: string;
  section_key: string;
  content: { [key: string]: any }; // jsonb content from DB
  order_index: number;
}

export default function Landing() {
  const [landingData, setLandingData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lang } = useLanguage(); // `lang` will be used for fetching locale-specific data; removed 't'

  useEffect(() => {
    const getLandingContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLandingData({ locale: lang, slug: 'home' }); // Fetch data for 'home' slug and current locale
        setLandingData(data);
      } catch (err: any) {
        console.error('Error fetching landing page data:', err);
        setError(err.message || 'Failed to load landing page content.');
      } finally {
        setLoading(false);
      }
    };

    getLandingContent();
  }, [lang]); // Re-fetch data when the language changes

  // Dynamic SEO - set title and meta description
  useEffect(() => {
    if (landingData?.page) {
      document.title = landingData.page.seo_title || "Tamm - AI Social Commerce Copilot";
      const metaDescriptionTag = document.querySelector('meta[name="description"]');
      if (metaDescriptionTag) {
        metaDescriptionTag.setAttribute('content', landingData.page.seo_description || "Tamm AI Social Commerce Copilot platform.");
      } else {
        const newMetaTag = document.createElement('meta');
        newMetaTag.name = 'description';
        newMetaTag.content = landingData.page.seo_description || "Tamm AI Social Commerce Copilot platform.";
        document.head.appendChild(newMetaTag);
      }
    }
  }, [landingData]);

  // Render logic for loading, error, and content
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Skeleton for Navigation */}
        <div className="h-16 flex items-center justify-between px-4 container mx-auto">
          <Skeleton className="h-8 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        {/* Skeleton for Hero Section */}
        <div className="flex-1 p-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-8 w-3/4 mx-auto mt-4" />
          <Skeleton className="h-6 w-1/2 mx-auto mt-2" />
        </div>
        {/* Add more skeleton loaders for other sections as needed */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <h1 className="text-2xl font-bold mb-2">Error Loading Page</h1>
          <p>{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!landingData || !landingData.sections || landingData.sections.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center text-gray-500">
          <h1 className="text-2xl font-bold mb-2">No Content Available</h1>
          <p>Please check back later or contact support.</p>
        </div>
      </div>
    );
  }

  // Helper to render sections dynamically
  const renderSection = (section: LandingPageSection) => {
    switch (section.section_key) { // Use section_key from DB
      case 'hero':
        return <HeroSection content={section.content} />; // Pass content jsonb
      case 'logos':
        return <LogosSection content={section.content} />; // Pass content jsonb
      case 'pricing':
        return <PricingSection pricingPlans={landingData.pricing || []} content={section.content} />;
      default:
        console.warn(`Unknown section_key: ${section.section_key}. No component mapped.`);
        return null;
    }
  };

  const navLinks = landingData.sections.filter(s => s.content?.nav_title && s.content?.target_id);
  const footerLinks = landingData.sections.filter(s => s.content?.footer_title && s.content?.target_id);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/tamm-logo.svg" alt="Tamm Logo" className="h-8" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((sec) => (
                <a key={sec.id} href={`#${sec.content.target_id}`} className="text-muted-foreground hover:text-foreground transition-colors">
                    {sec.content.nav_title}
                </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/login">
              <Button variant="ghost">{landingData.page.content?.login_button_text || 'Login'}</Button>
            </Link>
            <Link to="/login">
              <Button>{landingData.page.content?.start_button_text || 'Start Now'}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Render sections dynamically */}
      {landingData.sections.map((section) => (
        <div key={section.id} id={section.content?.target_id || section.section_key}> {/* Use ID for navigation */}
            {renderSection(section)}
        </div>
      ))}
      
      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <img src="/tamm-logo.svg" alt="Tamm Logo" className="h-8" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              {footerLinks.map((sec) => (
                  <a key={sec.id} href={`#${sec.content.target_id}`} className="hover:text-foreground transition-colors">
                      {sec.content.footer_title}
                  </a>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              {landingData.page.content?.copyright_text || '© 2025 Tamm. All rights reserved.'}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
