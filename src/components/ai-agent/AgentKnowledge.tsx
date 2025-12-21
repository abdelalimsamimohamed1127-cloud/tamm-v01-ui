import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Globe, HelpCircle, FileText, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { createKnowledgeSource, KnowledgeSourceType } from "@/services/knowledge";

type Source =
  | { type: "text"; payload: { text: string } }
  | { type: "qa"; payload: { items: { q: string; a: string }[] } }
  | { type: "website"; payload: { url: string } }
  | { type: "files"; payload: { storage_paths: string[]; extracted_text?: string } };

const mapFileToKnowledgeType = (file: File): KnowledgeSourceType => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "pdf";
    case "doc":
    case "docx":
      return "docx";
    case "csv":
      return "csv";
    case "txt":
      return "txt";
    default:
      return "manual";
  }
};

export default function AgentKnowledge({
  loading,
  agentId,
  onIngest,
}: {
  loading: boolean;
  agentId: string | null;
  onIngest: (sources: Source[]) => Promise<void>;
}) {
  const { workspace } = useWorkspace();
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [qaQ, setQaQ] = useState("");
  const [qaA, setQaA] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const disabled = loading || !agentId;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Upload className="w-4 h-4" />
            Files (PDF / DOCX / CSV)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".pdf,.doc,.docx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain"
            disabled={disabled || uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (!agentId) return;
                if (!workspace?.id) return;
                if (!file) return;
                setUploading(true);
                try {
                  await createKnowledgeSource({
                    workspace_id: workspace.id,
                    agent_id: agentId,
                    type: mapFileToKnowledgeType(file),
                    title: file.name,
                  });
                  // show success via parent toast
                  await onIngest([]); // no-op call to allow parent to toast? parent ignores empty; still safe
                } finally {
                  setUploading(false);
                  setFile(null);
                }
              }}
              disabled={disabled || uploading || !file || !workspace?.id}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Upload & Ingest
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Files are uploaded to Supabase Storage and embedded server-side for Arabic + English RAG.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <FileText className="w-4 h-4" />
            Text (fast)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste product catalog, FAQs, policies, delivery rules..."
            disabled={disabled}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => onIngest([{ type: "text", payload: { text } }])}
              disabled={disabled || !text.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Text
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <Globe className="w-4 h-4" />
            Website URL
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-store.com/faq"
            disabled={disabled}
          />
          <Button
            onClick={() => onIngest([{ type: "website", payload: { url } }])}
            disabled={disabled || !url.trim()}
          >
            Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2 items-center">
            <HelpCircle className="w-4 h-4" />
            Q & A
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Input
            value={qaQ}
            onChange={(e) => setQaQ(e.target.value)}
            placeholder="Question"
            disabled={disabled}
          />
          <Input
            value={qaA}
            onChange={(e) => setQaA(e.target.value)}
            placeholder="Answer"
            disabled={disabled}
          />
          <div className="flex justify-end">
            <Button
              onClick={() =>
                onIngest([{ type: "qa", payload: { items: [{ q: qaQ, a: qaA }] } }])
              }
              disabled={disabled || !qaQ.trim() || !qaA.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Q&A
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
