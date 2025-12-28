import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Globe, Database, HelpCircle, Info, Upload, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react"; // Added Trash2, CheckCircle2, XCircle
import { useAgent } from '@/hooks/useAgent';
import { useWorkspace } from '@/hooks'; // Import useWorkspace
import { createKnowledgeSource, getKnowledgeSourcesForAgent, deleteKnowledgeSource, uploadFileToStorage, KnowledgeSource, KnowledgeSourceType } from "@/services/knowledge"; // Import service and type
import { useToast } from "@/hooks/use-toast"; // Import toast for error feedback
import { Input } from "@/components/ui/input"; // Import Input
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea

interface AgentKnowledgeProps {
  agentId: string;
  interactionsDisabled: boolean; // Prop from parent to disable interactions
}

type KnowledgeTab = "files" | "website" | "text" | "qna" | null;

type SourceTotals = {
  filesKB: number;
  websiteKB: number;
  textKB: number;
  qnaKB: number;
  limitKB: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatKB(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb.toFixed(0)} KB`;
}

function SourceCard({
  icon: Icon,
  title,
  desc,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "group w-full text-left border rounded-xl p-4 transition-all",
        "hover:shadow-sm hover:-translate-y-[1px]",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        disabled ? "opacity-50 cursor-not-allowed bg-muted/40" : "bg-white",
      ].join(" ")}
    >
      <Icon className="h-5 w-5 mb-2 text-muted-foreground group-hover:text-foreground transition-colors" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // close only if backdrop clicked
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-xl border overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold truncate">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            className="rounded-full p-2 hover:bg-muted transition"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// Update SourcesState type
type SourcesStateEnhanced =
  | { status: "loading" }
  | { status: "loaded"; sources: KnowledgeSource[] }
  | { status: "failed"; error: string }
  | { status: "empty" };


export const AgentKnowledge: React.FC<AgentKnowledgeProps> = ({ agentId, interactionsDisabled }) => {
  const { toast } = useToast();
  const { activeWorkspace } = useWorkspace(); // Get active workspace
  
  const [sourcesState, setSourcesState] = useState<SourcesStateEnhanced>({ status: "empty" });
  const [activeSource, setActiveSource] = useState<KnowledgeTab>(null);

  // Form states inside modal
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [qQuestion, setQQuestion] = useState("");
  const [qAnswer, setQAnswer] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Loading states for each source type
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [isWebsiteFetching, setIsWebsiteFetching] = useState(false);
  const [isTextAdding, setIsTextAdding] = useState(false);
  const [isQnaAdding, setIsQnaAdding] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSources = async () => {
    if (!agentId) {
      setSourcesState({ status: "empty" });
      return;
    }
    setSourcesState({ status: "loading" });
    try {
      const fetchedSources = await getKnowledgeSourcesForAgent(agentId);
      if (fetchedSources.length > 0) {
        setSourcesState({ status: "loaded", sources: fetchedSources });
      } else {
        setSourcesState({ status: "empty" });
      }
    } catch (error: any) {
      console.error("Error fetching knowledge sources:", error);
      setSourcesState({ status: "failed", error: error.message || "Failed to load knowledge sources." });
      toast({
        title: "Error",
        description: "Failed to load knowledge sources.",
        variant: "destructive",
      });
    }
  };


  // Fetch knowledge sources when agentId changes
  useEffect(() => {
    fetchSources();
  }, [agentId]);

  // Clear modal states when agent or dialog changes
  useEffect(() => {
    setTextTitle("");
    setTextBody("");
    setQQuestion("");
    setQAnswer("");
    setWebsiteUrl("");
    setSelectedFile(null);
    // Keep activeSource as it controls the modal
  }, [agentId, activeSource]); // Clear when activeSource changes (modal opens/closes)

  // Polling for status updates
  useEffect(() => {
    const processingSources = sourcesState.status === "loaded" && sourcesState.sources.some(source => source.status === "processing");
    let intervalId: NodeJS.Timeout | undefined;

    if (processingSources) {
      intervalId = setInterval(() => {
        fetchSources();
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sourcesState.status, sourcesState.status === "loaded" ? sourcesState.sources : null]);

  const totals: SourceTotals = useMemo(() => {
    const base: SourceTotals = { filesKB: 0, websiteKB: 0, textKB: 0, qnaKB: 0, limitKB: 400 };

    if (sourcesState.status !== "loaded") return base; // Only process if loaded

    return sourcesState.sources.reduce<SourceTotals>((acc, source) => {
      // For now, size_kb is not directly available on KnowledgeSource.
      // We will need to assume a placeholder or add it to the DB schema if needed.
      // For this example, let's just count them.
      const sizeKb = 10; // Placeholder for now

      switch (source.type) {
        case "file": 
          acc.filesKB += sizeKb;
          break;
        case "url": 
          acc.websiteKB += sizeKb;
          break;
        case "manual": 
          acc.textKB += sizeKb;
          break;
        case "qna":
          acc.qnaKB += sizeKb;
          break;
        default:
          break;
      }

      return acc;
    }, base);
  }, [sourcesState]);

  const sourceCounts = useMemo(() => {
    const counts = { file: 0, url: 0, manual: 0, qna: 0 }; // Adjusted keys to match KnowledgeSourceType

    if (sourcesState.status !== "loaded") return counts; // Only process if loaded

    sourcesState.sources.forEach((source) => {
      switch (source.type) {
        case "file":
          counts.file += 1;
          break;
        case "url":
          counts.url += 1;
          break;
        case "manual":
          counts.manual += 1;
          break;
        case "qna":
          counts.qna += 1;
          break;
        default:
          break;
      }
    });

    return counts;
  }, [sourcesState]);

  const usedKB = totals.filesKB + totals.websiteKB + totals.textKB + totals.qnaKB;
  const usagePct = clamp((usedKB / totals.limitKB) * 100, 0, 100);

  const isSourcesLoading = sourcesState.status === "loading";
  const hasSources = sourcesState.status === "loaded" && sourcesState.sources.length > 0;
  const isSourcesFailed = sourcesState.status === "failed";

  const handleCreateSource = async (type: KnowledgeSourceType, title: string, payload: Record<string, any>) => {
    if (!activeWorkspace?.id || !agentId) {
      toast({ title: "Error", description: "Workspace or agent not selected.", variant: "destructive" });
      return;
    }
    
    // Set loading state based on type
    if (type === "file") setIsFileUploading(true);
    else if (type === "url") setIsWebsiteFetching(true);
    else if (type === "manual") setIsTextAdding(true);
    else if (type === "qna") setIsQnaAdding(true);

    try {
      await createKnowledgeSource({
        workspace_id: activeWorkspace.id,
        agent_id: agentId,
        type,
        title,
        payload,
      });
      toast({ title: "Success", description: `${title} source added and ingestion triggered.` });
      await fetchSources(); // Re-fetch sources to update UI
      setActiveSource(null); // Close modal on success
    } catch (error: any) {
      console.error(`Error adding ${type} source:`, error);
      toast({ title: "Error", description: `Failed to add ${title} source: ${error.message}`, variant: "destructive" });
    } finally {
      if (type === "file") setIsFileUploading(false);
      else if (type === "url") setIsWebsiteFetching(false);
      else if (type === "manual") setIsTextAdding(false);
      else if (type === "qna") setIsQnaAdding(false);
    }
  };

  // Handlers for each source type
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !activeWorkspace?.id || !agentId) {
      toast({ title: "Validation Error", description: "Please select a file and ensure workspace/agent are active.", variant: "destructive" });
      return;
    }
    
    setIsFileUploading(true);
    try {
      const uploadedFilePath = await uploadFileToStorage(selectedFile, agentId, activeWorkspace.id);
      await handleCreateSource("file", selectedFile.name, { file_path: uploadedFilePath });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({ title: "Error", description: `Failed to upload file: ${error.message}`, variant: "destructive" });
    } finally {
      setIsFileUploading(false);
      setSelectedFile(null); // Clear selected file after attempt
    }
  };

  const handleWebsiteSubmit = async () => {
    if (!websiteUrl.trim()) {
      toast({ title: "Validation Error", description: "Please enter a valid URL.", variant: "destructive" });
      return;
    }
    await handleCreateSource("url", websiteUrl, { url: websiteUrl });
  };

  const handleTextSubmit = async () => {
    if (!textBody.trim()) {
      toast({ title: "Validation Error", description: "Text content cannot be empty.", variant: "destructive" });
      return;
    }
    await handleCreateSource("manual", textTitle || "Manual Text Source", { text_content: textBody });
  };

  const handleQnaSubmit = async () => {
    if (!qQuestion.trim() || !qAnswer.trim()) {
      toast({ title: "Validation Error", description: "Question and Answer cannot be empty.", variant: "destructive" });
      return;
    }
    await handleCreateSource("qna", qQuestion.substring(0, 50) + "...", { question: qQuestion, answer: qAnswer });
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (interactionsDisabled) return;

    setIsDeletingSource(sourceId); // Set currently deleting source
    try {
      await deleteKnowledgeSource(sourceId);
      toast({ title: "Source Deleted", description: "Knowledge source removed successfully." });
      await fetchSources(); // Re-fetch sources to update UI
    } catch (error: any) {
      console.error("Error deleting source:", error);
      toast({ title: "Error", description: `Failed to delete source: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeletingSource(null);
    }
  };


  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg">Knowledge Sources</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          disabled={interactionsDisabled}
          onClick={() => {
            if (interactionsDisabled) return;
            // No specific tab to open, just toggle the "Manage" view if implemented
            // For now, let's keep it as is, or remove if not needed.
            // setActiveSource("files"); // Example: opens files tab by default
          }}
          title="Open sources"
        >
          <Info className="h-4 w-4" />
          Manage
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SourceCard
          icon={FileText}
          title="Files"
          desc="PDF, DOCX, TXT"
          onClick={() => setActiveSource("files")}
          disabled={interactionsDisabled}
        />
        <SourceCard
          icon={Globe}
          title="Website"
          desc="Crawl pages"
          onClick={() => setActiveSource("website")}
          disabled={interactionsDisabled}
        />
        <SourceCard
          icon={Database}
          title="Text"
          desc="Paste content"
          onClick={() => setActiveSource("text")}
          disabled={interactionsDisabled}
        />
        <SourceCard
          icon={HelpCircle}
          title="Q&A"
          desc="Questions & answers"
          onClick={() => setActiveSource("qna")}
          disabled={interactionsDisabled}
        />
      </div>

      {/* STORAGE STATUS BAR */}
      <div className="mt-2 rounded-xl border p-4 bg-muted/40">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Knowledge usage</span>
          <span className="font-semibold">
            {formatKB(usedKB)} / {formatKB(totals.limitKB)}
          </span>
        </div>

        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${usagePct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {isSourcesFailed && <span className="text-destructive">Failed to load sources.</span>}
          {isSourcesLoading && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading sources...</span>}
          {sourcesState.status === "empty" && <span>No knowledge sources yet.</span>}
          {hasSources && (
            <>
              <span>📄 Files: {sourceCounts.file} ({formatKB(totals.filesKB)})</span>
              <span>🌐 Website: {sourceCounts.url} ({formatKB(totals.websiteKB)})</span>
              <span>📝 Text: {sourceCounts.manual} ({formatKB(totals.textKB)})</span>
              <span>❓ Q&amp;A: {sourceCounts.qna} ({formatKB(totals.qnaKB)})</span>
            </>
          )}
        </div>
      </div>

      {/* =============================
          POPUP WINDOWS (MODALS)
      ============================== */}
      
      {activeSource === "files" && (
        <ModalShell
          title="Files"
          subtitle="Upload documents to train your AI. Extract text from PDFs, DOCX, and TXT files."
          onClose={() => setActiveSource(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-3 text-sm flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span>
                If you upload a PDF, make sure the text is selectable (not a scanned
                image).
              </span>
            </div>

            <div className="rounded-2xl border border-dashed p-8 text-center bg-white">
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">
                Drag &amp; drop files here, or click to select
              </p>              
              <p className="text-xs text-muted-foreground mt-1">
                Supported: pdf, doc, docx, txt
              </p>

              <div className="mt-4">
                <Input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden" // Hide the default file input
                  ref={fileInputRef}
                  disabled={interactionsDisabled || isFileUploading}
                  accept=".pdf,.doc,.docx,.txt"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()} // Trigger click on hidden input
                  disabled={interactionsDisabled || isFileUploading}
                >
                  {selectedFile ? selectedFile.name : "Select file"}
                </Button>
                {selectedFile && (
                  <Button
                    className="ml-2"
                    onClick={handleFileUpload}
                    disabled={interactionsDisabled || isFileUploading}
                  >
                    {isFileUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    {isFileUploading ? "Uploading..." : "Upload"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 p-4">
              <p className="font-medium text-sm">Existing Files</p>
              {isSourcesLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading files...</p>
              ) : (
                <ScrollArea className="h-48 rounded-md border p-4">
                  {(sourcesState.status === "loaded" && sourcesState.sources.filter(s => s.type === "file").length > 0) ? (
                    sourcesState.sources.filter(s => s.type === "file").map(source => (
                      <div key={source.id} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-2">
                          {source.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          {source.status === "active" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {source.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                          <span className="truncate">{source.title}</span>
                          {source.status === "failed" && <span className="text-destructive text-xs">(Failed)</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSource(source.id)}
                          disabled={interactionsDisabled || isDeletingSource === source.id || source.status === "processing"}
                          title="Delete source"
                        >
                          {isDeletingSource === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No file sources yet.</p>
                  )}
                </ScrollArea>
              )}
            </div>
            
            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Files summary</p>
                <p className="text-muted-foreground text-xs">
                  {sourceCounts.file} file source{sourceCounts.file === 1 ? "" : "s"} available
                </p>
              </div>
              <Button className="px-6" disabled>
                Retrain agent
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {activeSource === "website" && (
        <ModalShell
          title="Website"
          subtitle="Crawl web pages or submit sitemaps to update your AI with the latest content."
          onClose={() => setActiveSource(null)}
        >
          <div className="space-y-4">
            <div className="rounded-xl border p-4 bg-muted/30">
              <p className="font-medium text-sm">Add links</p>

              <div className="mt-3 grid gap-2">
                <label className="text-xs text-muted-foreground">URL</label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  disabled={interactionsDisabled || isWebsiteFetching}
                />
                <p className="text-xs text-muted-foreground">
                  Links found during crawling may update if new links are discovered.
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <Button 
                  onClick={handleWebsiteSubmit}
                  disabled={interactionsDisabled || isWebsiteFetching || !websiteUrl.trim()}
                >
                  {isWebsiteFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isWebsiteFetching ? "Fetching..." : "Fetch links"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 p-4">
              <p className="font-medium text-sm">Existing Websites</p>
              {isSourcesLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading websites...</p>
              ) : (
                <ScrollArea className="h-48 rounded-md border p-4">
                  {(sourcesState.status === "loaded" && sourcesState.sources.filter(s => s.type === "url").length > 0) ? (
                    sourcesState.sources.filter(s => s.type === "url").map(source => (
                      <div key={source.id} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-2">
                          {source.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          {source.status === "active" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {source.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                          <span className="truncate">{source.title}</span>
                          {source.status === "failed" && <span className="text-destructive text-xs">(Failed)</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSource(source.id)}
                          disabled={interactionsDisabled || isDeletingSource === source.id || source.status === "processing"}
                          title="Delete source"
                        >
                          {isDeletingSource === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No website sources yet.</p>
                  )}
                </ScrollArea>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Websites summary</p>
                <p className="text-muted-foreground text-xs">
                  {sourceCounts.url} website source{sourceCounts.url === 1 ? "" : "s"} available
                </p>
              </div>
              <Button className="px-6" disabled>
                Retrain agent
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {activeSource === "text" && (
        <ModalShell
          title="Text"
          subtitle="Add plain text sources to train your AI Agent with precise information."
          onClose={() => setActiveSource(null)}
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Ex: Refund requests"
                disabled={interactionsDisabled || isTextAdding}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Text</label>
              <Textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Paste your text here..."
                className="min-h-[160px]"
                disabled={interactionsDisabled || isTextAdding}
              />
            </div>

            <div className="flex gap-2 justify-end p-4">
                <Button variant="outline" onClick={() => setTextBody("")} disabled={interactionsDisabled || isTextAdding}>
                  Clear
                </Button>
                <Button 
                  onClick={handleTextSubmit}
                  disabled={interactionsDisabled || isTextAdding || !textBody.trim()}
                >
                  {isTextAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {isTextAdding ? "Adding..." : "Add text"}
                </Button>
            </div>

            <div className="flex flex-col gap-2 p-4">
              <p className="font-medium text-sm">Existing Text Sources</p>
              {isSourcesLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading text sources...</p>
              ) : (
                <ScrollArea className="h-48 rounded-md border p-4">
                  {(sourcesState.status === "loaded" && sourcesState.sources.filter(s => s.type === "manual").length > 0) ? (
                    sourcesState.sources.filter(s => s.type === "manual").map(source => (
                      <div key={source.id} className="flex items-center justify-between text-sm py-1">
                        <span className="flex items-center gap-2">
                          {source.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                          {source.status === "active" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          {source.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                          <span className="truncate">{source.title}</span>
                          {source.status === "failed" && <span className="text-destructive text-xs">(Failed)</span>}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSource(source.id)}
                          disabled={interactionsDisabled || isDeletingSource === source.id || source.status === "processing"}
                          title="Delete source"
                        >
                          {isDeletingSource === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No text sources yet.</p>
                  )}
                </ScrollArea>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Text summary</p>
                <p className="text-muted-foreground text-xs">
                  {sourceCounts.manual} text source{sourceCounts.manual === 1 ? "" : "s"} available
                </p>
              </div>
              <Button className="px-6" disabled>
                Retrain agent
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {activeSource === "qna" && (
        <ModalShell
          title="Q&A"
          subtitle="Add curated question/answer pairs for high-precision responses."
          onClose={() => setActiveSource(null)}
        >
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Question</label>
              <Input
                value={qQuestion}
                onChange={(e) => setQQuestion(e.target.value)}
                placeholder="Ex: What is your return policy?"
                disabled={interactionsDisabled || isQnaAdding}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Answer</label>
              <Textarea
                value={qAnswer}
                onChange={(e) => setQAnswer(e.target.value)}
                placeholder="Ex: You can return any item within 14 days..."
                className="min-h-[140px]"
                disabled={interactionsDisabled || isQnaAdding}
              />
            </div>

                        <div className="flex gap-2 justify-end p-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setQQuestion("");
                                setQAnswer("");
                              }}
                              disabled={interactionsDisabled || isQnaAdding}
                            >
                              Clear
                            </Button>
                            <Button 
                              onClick={handleQnaSubmit}
                              disabled={interactionsDisabled || isQnaAdding || !qQuestion.trim() || !qAnswer.trim()}
                            >
                              {isQnaAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              {isQnaAdding ? "Adding..." : "Add Q&A"}
                            </Button>
                        </div>
            
                        <div className="flex flex-col gap-2 p-4">
                          <p className="font-medium text-sm">Existing Q&A Sources</p>
                          {isSourcesLoading ? (
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Loading Q&A sources...</p>
                          ) : (
                            <ScrollArea className="h-48 rounded-md border p-4">
                              {(sourcesState.status === "loaded" && sourcesState.sources.filter(s => s.type === "qna").length > 0) ? (
                                sourcesState.sources.filter(s => s.type === "qna").map(source => (
                                  <div key={source.id} className="flex items-center justify-between text-sm py-1">
                                    <span className="flex items-center gap-2">
                                      {source.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                      {source.status === "active" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                      {source.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                                      <span className="truncate">{source.title}</span>
                                      {source.status === "failed" && <span className="text-destructive text-xs">(Failed)</span>}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteSource(source.id)}
                                      disabled={interactionsDisabled || isDeletingSource === source.id || source.status === "processing"}
                                      title="Delete source"
                                    >
                                      {isDeletingSource === source.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No Q&A sources yet.</p>
                              )}
                            </ScrollArea>
                          )}
                        </div>
            
                        <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
                          <div className="text-sm">
                            <p className="font-medium">Q&A summary</p>
                            <p className="text-muted-foreground text-xs">
                              {sourceCounts.qna} Q&A source{sourceCounts.qna === 1 ? "" : "s"} available
                            </p>
                          </div>
                          <Button className="px-6" disabled>
                            Retrain agent
                          </Button>
                        </div>          </div>
        </ModalShell>
      )}
    </Card>
  );
};