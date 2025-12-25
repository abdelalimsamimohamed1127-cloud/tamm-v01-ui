import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface LandingPageSection {
  id: number;
  section_type: string;
  translations: any;
  sort_order: number;
  is_enabled: boolean;
}

export default function LandingPageCMS() {
  const [sections, setSections] = useState<LandingPageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLang, setCurrentLang] = useState('en');
  const { toast } = useToast();

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('landing_page_sections')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) {
      toast({ title: 'Error fetching sections', description: error.message, variant: 'destructive' });
    } else {
      setSections(data || []);
    }
    setLoading(false);
  };

  const handleContentChange = (sectionId: number, lang: string, newContent: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        try {
            const newTranslations = { ...s.translations, [lang]: JSON.parse(newContent) };
            return { ...s, translations: newTranslations };
        } catch (e) {
            console.error("Invalid JSON:", e);
            // Optionally, handle invalid JSON input, e.g., show a validation error.
            // For now, we'll just not update the state if JSON is invalid.
            return s;
        }
      }
      return s;
    }));
  };
  
  const handleEnabledChange = async (sectionId: number, is_enabled: boolean) => {
    const { error } = await supabase
        .from('landing_page_sections')
        .update({ is_enabled })
        .eq('id', sectionId);

    if (error) {
        toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    } else {
        toast({ title: 'Success', description: 'Section status updated.' });
        fetchSections();
    }
  }

  const handleSave = async (sectionId: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    try {
        const { error } = await supabase
            .from('landing_page_sections')
            .update({ translations: section.translations })
            .eq('id', sectionId);

        if (error) {
            throw error;
        }
        toast({ title: 'Success', description: 'Section saved successfully.' });
    } catch (error: any) {
        toast({ title: 'Error saving section', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div>Loading CMS...</div>;
  }

  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Landing Page Sections</h2>
            <div className="flex gap-2">
                <Button onClick={() => setCurrentLang('en')} variant={currentLang === 'en' ? 'default' : 'outline'}>English</Button>
                <Button onClick={() => setCurrentLang('ar')} variant={currentLang === 'ar' ? 'default' : 'outline'}>Arabic</Button>
                <Button onClick={fetchSections} variant="outline">Refresh</Button>
            </div>
        </div>
      {sections.map(section => (
        <Card key={section.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="capitalize">{section.section_type.replace('_', ' ')}</CardTitle>
                    <CardDescription>Order: {section.sort_order}</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                    <Label htmlFor={`enabled-switch-${section.id}`}>{section.is_enabled ? 'Enabled' : 'Disabled'}</Label>
                    <Switch
                        id={`enabled-switch-${section.id}`}
                        checked={section.is_enabled}
                        onCheckedChange={(checked) => handleEnabledChange(section.id, checked)}
                    />
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Content ({currentLang.toUpperCase()})</Label>
            <Textarea
              value={JSON.stringify(section.translations[currentLang] || {}, null, 2)}
              onChange={(e) => handleContentChange(section.id, currentLang, e.target.value)}
              rows={15}
              className="font-mono text-sm"
              dir="ltr"
            />
            <Button onClick={() => handleSave(section.id)}>Save Section</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
