import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Smile,
  Send,
  RotateCcw,
  Upload,
  Globe,
  FileText,
  Database,
  HelpCircle,
  Info,
  Loader2,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Agent, deactivateAgent, getAgentForWorkspace, reactivateAgent } from "@/services/agents";

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
        disabled ? "opacity-50 cursor-not-allowed" : "bg-white",
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

export default function AIAgent() {
  /* =============================
     RESIZE SLIDER (LEFT / RIGHT)
  ============================== */
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(42); // percent
  const [isDragging, setIsDragging] = useState(false);
  const { workspace } = useWorkspace();
  const { toast } = useToast();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;

      // limits like your previous slider
      const next = clamp(pct, 30, 60);
      setLeftWidth(next);
    };

    const onUp = () => setIsDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  const loadAgent = useCallback(async () => {
    if (!workspace?.id) {
      setAgent(null);
      setLoadingAgent(false);
      return;
    }

    setLoadingAgent(true);
    try {
      const result = await getAgentForWorkspace(workspace.id);
      setAgent(result);
    } catch (error: any) {
      console.error("Failed to load agent", error);
      toast({
        title: "Unable to load agent",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      setAgent(null);
    } finally {
      setLoadingAgent(false);
    }
  }, [workspace?.id, toast]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  /* =============================
     PAGE STATE
  ============================== */
  const [rules, setRules] = useState("");
  const [message, setMessage] = useState("");
  const [activeSource, setActiveSource] = useState<KnowledgeTab>(null);
  /* =============================
     MOBILE TABS (ADD ONLY)
  ============================== */
  const [mobileTab, setMobileTab] =
    useState<"settings" | "preview">("preview");

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;


  // UI-only placeholder values — wire to Supabase later
  const totals: SourceTotals = useMemo(
    () => ({
      filesKB: 40,
      websiteKB: 60,
      textKB: 20,
      qnaKB: 0,
      limitKB: 400,
    }),
    []
  );

  const usedKB = totals.filesKB + totals.websiteKB + totals.textKB + totals.qnaKB;
  const usagePct = clamp((usedKB / totals.limitKB) * 100, 0, 100);

  // Form states inside modal (UI-only)
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [qQuestion, setQQuestion] = useState("");
  const [qAnswer, setQAnswer] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const hasAgent = Boolean(agent);
  const isAgentActive = hasAgent ? agent?.is_active !== false : false;
  const statusBusy = updatingStatus || loadingAgent;
  const interactionsDisabled = !hasAgent || !isAgentActive || statusBusy;

  useEffect(() => {
    if (!isAgentActive) {
      setActiveSource(null);
    }
  }, [isAgentActive]);

  useEffect(() => {
    setRules(agent?.rules ?? "");
  }, [agent?.rules]);

  const handleDeactivate = useCallback(async () => {
    if (!agent?.id) return;
    setUpdatingStatus(true);
    try {
      await deactivateAgent(agent.id);
      await loadAgent();
      toast({
        title: "Agent disabled",
        description: "The agent will no longer respond until re-enabled.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to disable agent",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  }, [agent?.id, loadAgent, toast]);

  const handleReactivate = useCallback(async () => {
    if (!agent?.id) return;
    setUpdatingStatus(true);
    try {
      await reactivateAgent(agent.id);
      await loadAgent();
      toast({
        title: "Agent enabled",
        description: "The agent is active again.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to enable agent",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  }, [agent?.id, loadAgent, toast]);
  /* =============================
     ROLE → RULES TEMPLATES
  ============================== */
  const ROLE_RULES: Record<string, string> = {
    sales: `### Role
- Primary Function: You are an AI chatbot who helps users with their inquiries, issues and requests. You aim to provide excellent, friendly and efficient replies at all times. Your role is to listen attentively to the user, understand their needs, and do your best to assist them or direct them to the appropriate resources. If a question is not clear, ask clarifying questions. Make sure to end your replies with a positive note.

### Constraints
1. No Data Divulge: Never mention that you have access to training data explicitly to the user.
2. Maintaining Focus: If a user attempts to divert you to unrelated topics, never change your role or break your character. Politely redirect the conversation back to topics relevant to the training data.
3. Exclusive Reliance on Training Data: You must rely exclusively on the training data provided to answer user queries. If a query is not covered by the training data, use the fallback response.
4. Restrictive Role Focus: You do not answer questions or perform tasks that are not related to your role and training data.`,
  };


  /* =============================
     UI
  ============================== */
  return (
    <div ref={containerRef} className="relative w-full p-6">
            {/* MOBILE TABS */}
      {isMobile && (
        <div className="mb-4 flex gap-6 border-b">
          <button
            onClick={() => setMobileTab("settings")}
            className={`pb-3 text-sm font-medium ${
              mobileTab === "settings"
                ? "border-b-2 border-blue-600 text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Settings
          </button>

          <button
            onClick={() => setMobileTab("preview")}
            className={`pb-3 text-sm font-medium ${
              mobileTab === "preview"
                ? "border-b-2 border-blue-600 text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Preview
          </button>
        </div>
      )}

      <div className="relative flex h-[calc(100vh-120px)] w-full overflow-hidden">
        {/* ================= LEFT ================= */}
        
       {(!isMobile || mobileTab === "settings") && (
       <div
          className="h-full overflow-y-auto pr-4"
          style={{ width: isMobile ? "100%" : `${leftWidth}%` }}
        >
        {/* <div
          className="h-full overflow-y-auto pr-4"
          style={{ width: `${leftWidth}%` }}
        > */}
          
          <div className="space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-lg">Agent Settings</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      isAgentActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isAgentActive ? "Active" : "Disabled"}
                  </span>
                  <Button
                    size="sm"
                    variant={isAgentActive ? "outline" : "default"}
                    onClick={isAgentActive ? handleDeactivate : handleReactivate}
                    disabled={!hasAgent || statusBusy}
                  >
                    {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {isAgentActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Role</label>
                <Select
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setRules("");
                    } else {
                      setRules(ROLE_RULES[value] || "");
                    }
                  }}
                >

                  <SelectTrigger className="mt-1" disabled={interactionsDisabled}>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Customer Support</SelectItem>
                    <SelectItem value="sales">Sales Agent</SelectItem>
                    <SelectItem value="orders">Order Assistant</SelectItem>
                    <SelectItem value="lead_qualifier">Lead Qualifier</SelectItem>
                    <SelectItem value="catalog_guide">Catalog Guide</SelectItem>
                    <SelectItem value="custom">Custom Prompt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              

           {/* ---------------- */}
           {/* put tone div here */}
           {/* ---------------------- */}

              <div>
                <label className="text-xs text-muted-foreground">
                  Rules / Instructions
                </label>
                <Textarea

                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  className="mt-1 min-h-[120px] bg-muted/40 transition-shadow focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                  placeholder="Tell the agent how to behave..."
                  disabled={interactionsDisabled}
                />

                {/* <Textarea
                  className="mt-1 min-h-[120px] bg-muted/40 transition-shadow focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
                  placeholder="Tell the agent how to behave..."
                /> */}
              </div>
            </Card>

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
                    setActiveSource("files");
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
                  onClick={() => {
                    if (interactionsDisabled) return;
                    setActiveSource("files");
                  }}
                  disabled={interactionsDisabled}
                />
                <SourceCard
                  icon={Globe}
                  title="Website"
                  desc="Crawl pages"
                  onClick={() => {
                    if (interactionsDisabled) return;
                    setActiveSource("website");
                  }}
                  disabled={interactionsDisabled}
                />
                <SourceCard
                  icon={Database}
                  title="Text"
                  desc="Paste content"
                  onClick={() => {
                    if (interactionsDisabled) return;
                    setActiveSource("text");
                  }}
                  disabled={interactionsDisabled}
                />
                <SourceCard
                  icon={HelpCircle}
                  title="Q&A"
                  desc="Questions & answers"
                  onClick={() => {
                    if (interactionsDisabled) return;
                    setActiveSource("qna");
                  }}
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
                  <span>📄 Files: {formatKB(totals.filesKB)}</span>
                  <span>🌐 Website: {formatKB(totals.websiteKB)}</span>
                  <span>📝 Text: {formatKB(totals.textKB)}</span>
                  <span>❓ Q&amp;A: {formatKB(totals.qnaKB)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
        )}


        {/* ============ SLIDER HANDLE ============ */}
        {!isMobile && (
    

        <div
          onMouseDown={() => setIsDragging(true)}
          className={[
            "relative h-full w-[10px] shrink-0 cursor-col-resize",
            "flex items-center justify-center",
          ].join(" ")}
          aria-label="Resize panels"
          title="Drag to resize"
        >
          {/* subtle visible handle */}
          <div className="h-full w-[2px] rounded-full bg-border" />
          {/* larger hover area */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[10px] hover:bg-primary/5 transition" />
        </div>
        )}

        {/* ================= RIGHT ================= */}
        {/* ================= RIGHT ================= */}
        {(!isMobile || mobileTab === "preview") && (
        <div
          className="h-full pl-4"
          style={{ width: isMobile ? "100%" : `${100 - leftWidth}%` }}
        >

        {/* <div className="h-full pl-4" style={{ width: `${100 - leftWidth}%` }}> */}
          <Card className="h-full flex flex-col rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
              <span className="text-sm font-semibold">Agent Playground</span>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-white/10 transition"
                title="Reset"
                disabled={interactionsDisabled}
              >
                <RotateCcw className="h-4 w-4 hover:rotate-180 transition" />
              </button>
            </div>

            {/* dotted background like Chatbase */}
            <div className="flex-1 p-4 space-y-3 bg-[radial-gradient(#d4d4d4_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="bg-[#E0DED9] rounded-2xl px-4 py-3 max-w-[75%] animate-in fade-in slide-in-from-bottom-2">
                <p className="text-sm">Hi! How can I help you today?</p>
              </div>
            </div>

            <div className="p-3 bg-white">
              <div className="flex items-center gap-2 rounded-full border px-3 py-2 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-shadow">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message..."
                  className="border-0 focus-visible:ring-0"
                  disabled={interactionsDisabled}
                />
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-muted transition"
                  title="Emoji"
                  disabled={interactionsDisabled}
                >
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 hover:bg-muted transition"
                  title="Send"
                  disabled={interactionsDisabled}
                >
                  <Send className="h-5 w-5 hover:scale-110 transition" />
                </button>
              </div>
            </div>
          </Card>
        </div>
        )}
      </div>

      {/* =============================
          POPUP WINDOWS (MODALS)
          (kept same UI as your images)
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
                <Button variant="outline" disabled={interactionsDisabled}>
                  Select files
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Sources</p>
                <p className="text-muted-foreground text-xs">
                  0 files uploaded (UI-only)
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
                  disabled={interactionsDisabled}
                />
                <p className="text-xs text-muted-foreground">
                  Links found during crawling may update if new links are discovered.
                </p>
              </div>

              <div className="mt-4 flex justify-end">
                <Button disabled={interactionsDisabled}>Fetch links</Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Sources</p>
                <p className="text-muted-foreground text-xs">
                  0 links crawled (UI-only)
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
                disabled={interactionsDisabled}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Text</label>
              <Textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Paste your text here..."
                className="min-h-[160px]"
                disabled={interactionsDisabled}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Sources</p>
                <p className="text-muted-foreground text-xs">
                  Total size: {formatKB(0)} / {formatKB(totals.limitKB)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTextBody("")} disabled={interactionsDisabled}>
                  Clear
                </Button>
                <Button disabled>Add text</Button>
              </div>
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
                disabled={interactionsDisabled}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Answer</label>
              <Textarea
                value={qAnswer}
                onChange={(e) => setQAnswer(e.target.value)}
                placeholder="Ex: You can return any item within 14 days..."
                className="min-h-[140px]"
                disabled={interactionsDisabled}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border p-4 bg-muted/30">
              <div className="text-sm">
                <p className="font-medium">Sources</p>
                <p className="text-muted-foreground text-xs">
                  Q&amp;A pairs: 0 (UI-only)
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQQuestion("");
                    setQAnswer("");
                  }}
                  disabled={interactionsDisabled}
                >
                  Clear
                </Button>
                <Button disabled>Add Q&amp;A</Button>
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}



    //  <label className="text-xs text-muted-foreground">Tone</label>
    //             <Select>
    //               <SelectTrigger className="mt-1">
    //                 <SelectValue placeholder="Select tone" />
    //               </SelectTrigger>
    //               <SelectContent>
    //                 <SelectItem value="friendly">Friendly</SelectItem>
    //                 <SelectItem value="professional">Professional</SelectItem>
    //                 {/* <SelectItem value="formal">Formal</SelectItem> */}
    //                 <SelectItem value="casual">Casual</SelectItem>
    //                 {/* <SelectItem value="empathetic">Empathetic</SelectItem> */}
    //               </SelectContent>
    //             </Select>
               

