import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const configured = useMemo(() => Boolean(supabase && isSupabaseConfigured), []);

  useEffect(() => {
    let isMounted = true;

    if (!configured) {
      navigate('/login', { replace: true });
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (session && !errorMessage) {
        navigate('/dashboard', { replace: true });
      } else if (event === 'SIGNED_OUT') {
        navigate('/login', { replace: true });
      }
    });

    const handleCallback = async () => {
      try {
        // Supabase OAuth PKCE flow returns `?code=...` in the URL query.
        // Older implicit flows used `#access_token=...` hash fragments.
        // We handle both safely and then clean the URL to avoid repeated exchanges.
        const url = new URL(window.location.href);
        const hasAuthCode = url.searchParams.has('code');
        const hasHashFragment = Boolean(url.hash);

        if (hasAuthCode || hasHashFragment) {
          const { error } = await supabase!.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;

          // Clean up URL (remove query/hash) after successful exchange.
          window.history.replaceState({}, document.title, url.pathname);
        }

        const { data, error } = await supabase!.auth.getSession();
        if (error || !data.session) {
          throw error ?? new Error('No active session.');
        }

        navigate('/dashboard', { replace: true });
      } catch (error) {
        if (!isMounted) return;
        console.error('Auth callback error:', error);
        setErrorMessage(error instanceof Error ? error.message : 'Authentication failed.');
        setTimeout(() => navigate('/login', { replace: true }), 1200);
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configured, errorMessage, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {errorMessage ?? 'Signing you in...'}
        </p>
      </div>
    </div>
  );
}
