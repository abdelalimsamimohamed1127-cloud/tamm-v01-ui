import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';

type RagTrace = {
  id: string;
  created_at: string;
  conversation_id: string | null;
  message_id: string | null;
  query_text: string;
  rewritten_query: string | null;
  confidence: number | null;
  citations: any;
  rerank_scores: any;
};

export default function Evals() {
  const { t, dir } = useLanguage();
  const { workspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [traces, setTraces] = useState<RagTrace[]>([]);

  useEffect(() => {
    void load();
  }, [workspace?.id]);

  async function load() {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('rag_traces')
      .select('id,created_at,conversation_id,message_id,query_text,rewritten_query,confidence,citations,rerank_scores')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setTraces((data as any) ?? []);
    setLoading(false);
  }

  const rows = useMemo(() => traces, [traces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.evals')}</h1>
        <p className="text-muted-foreground">
          {dir === 'rtl' ? 'راجع أسباب جودة الردود وثقة الـ RAG' : 'Review RAG traces, confidence, and citations'}
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No traces yet</CardTitle>
            <CardDescription>Send messages in Playground to generate traces.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{r.query_text}</CardTitle>
                    <CardDescription>{new Date(r.created_at).toLocaleString()}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        r.confidence != null && r.confidence >= 0.65
                          ? 'default'
                          : r.confidence != null && r.confidence >= 0.45
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      confidence: {r.confidence?.toFixed?.(2) ?? 'n/a'}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Thumbs up"
                      onClick={() =>
                        void supabase.functions.invoke('submit_message_feedback', {
                          body: {
                            workspace_id: workspace?.id,
                            conversation_id: r.conversation_id,
                            message_id: r.message_id,
                            rating: 1,
                          },
                        })
                      }
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Thumbs down"
                      onClick={() =>
                        void supabase.functions.invoke('submit_message_feedback', {
                          body: {
                            workspace_id: workspace?.id,
                            conversation_id: r.conversation_id,
                            message_id: r.message_id,
                            rating: -1,
                          },
                        })
                      }
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.rewritten_query ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Rewritten:</span> {r.rewritten_query}
                  </div>
                ) : null}

                <Separator />

                <div className="grid gap-2">
                  <div className="text-sm font-medium">Citations</div>
                  <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-3 rounded-md overflow-auto">
{JSON.stringify(r.citations ?? [], null, 2)}
                  </pre>
                </div>

                <div className="grid gap-2">
                  <div className="text-sm font-medium">Rerank</div>
                  <pre className="text-xs whitespace-pre-wrap bg-muted/30 p-3 rounded-md overflow-auto">
{JSON.stringify(r.rerank_scores ?? [], null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
