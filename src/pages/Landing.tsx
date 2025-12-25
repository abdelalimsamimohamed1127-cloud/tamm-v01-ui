import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import HeroSection from '@/components/landing/HeroSection';
import LogosSection from '@/components/landing/LogosSection';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';

interface LandingPageSection {
  key: string;
  [key: string]: any;
}

export default function Landing() {
  const [sections, setSections] = useState<LandingPageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang, t } = useLanguage();

  useEffect(() => {
    const fetchSections = async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-landing', {
        body: { slug: 'home', lang },
      });
      
      if (error) {
        console.error('Error fetching landing page sections:', error);
      } else {
        setSections(data || []);
      }
      setLoading(false);
    };

    fetchSections();
  }, [lang]);

  const renderSection = (section: LandingPageSection) => {
    switch (section.key) {
      case 'hero':
        return <HeroSection content={section} />;
      case 'logos':
        return <LogosSection content={section} />;
      // Add cases for other section types here
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center">Loading...</div>; // Replace with a proper skeleton loader later
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/">
            <img src="/tamm-logo.svg" alt="Tamm Logo" className="h-8" />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.features')}
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.pricing')}
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              {t('nav.docs')}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/login">
              <Button variant="ghost">{t('nav.login')}</Button>
            </Link>
            <Link to="/login">
              <Button>{t('nav.start')}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {sections.map((section, index) => (
        <div key={`${section.key}-${index}`}>
            {renderSection(section)}
        </div>
      ))}
      
      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <img src="/tamm-logo.svg" alt="Tamm Logo" className="h-8" />
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.docs')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.privacy')}</a>
              <a href="#" className="hover:text-foreground transition-colors">{t('footer.terms')}</a>
            </div>
            <div className="text-sm text-muted-foreground">
              {t('footer.copyright')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
