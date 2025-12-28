import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks";
import { useAdminGuard } from "@/hooks/admin/useAdminGuard";
import NotAuthorized from "./NotAuthorized";
import { MarkdownViewer } from "@/components/docs/MarkdownViewer";
import { useChannelDocLanguages } from "@/hooks/useChannelDocLanguages";
import { useChannelDocPermissions } from "@/hooks/useChannelDocPermissions";
import { ChannelPermission, ChannelLanguagePermission } from "@/services/channelDocPermissions";
import { createChannelDocVersion, fetchDocVersions } from "@/services/channelDocVersions";
import { fetchChannelDocAuditLogs, ChannelDocAudit } from "@/services/channelDocAudit";
import { fetchLatestChannelDocVersion } from "@/services/channelDocs";

const CHANNEL_OPTIONS = [
  { key: "widget", label: "Chat Widget" },
  { key: "help", label: "Help Page" },
  { key: "email", label: "Email" },
  { key: "zapier", label: "Zapier" },
  { key: "slack", label: "Slack" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "messenger", label: "Messenger" },
  { key: "api", label: "API" },
];

const BASE_LANGUAGES = ["en", "ar"];
const ROLES = ["owner", "admin", "support", "member"];

export default function AdminDocs() {
  const { isAdmin, isLoading: adminLoading } = useAdminGuard();
  const { workspaceId } = useWorkspace(); // Changed to workspaceId
  const [channelKey, setChannelKey] = useState(CHANNEL_OPTIONS[0]?.key ?? "widget");
  const [langCode, setLangCode] = useState(BASE_LANGUAGES[0]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<ChannelDocAudit[]>([]);

  const { languages, addLanguage, refresh: refreshLanguages } = useChannelDocLanguages(channelKey);
  const { permissions, languagePermissions, updatePermission, updateLanguagePermission } =
    useChannelDocPermissions(channelKey);

  const availableLanguages = useMemo(() => {
    const existing = languages.map((l) => l.lang_code);
    return Array.from(new Set([...BASE_LANGUAGES, ...existing]));
  }, [languages]);

  // Use a stable useCallback for loadLatest
  const loadLatest = useCallback(async () => {
    if (!workspaceId || !channelKey || !langCode) return; // Added workspaceId check
    const latest = await fetchLatestChannelDocVersion(workspaceId, channelKey, langCode); // Used workspaceId
    if (latest) {
      setTitle(latest.title ?? "");
      setContent(latest.content_md ?? "");
    } else {
      setTitle("");
      setContent("");
    }
  }, [workspaceId, channelKey, langCode]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  // Use a stable useCallback for loadVersions
  const loadVersions = useCallback(async () => {
    if (!workspaceId || !channelKey) return; // Added workspaceId check
    const data = await fetchDocVersions(workspaceId, channelKey, langCode); // Used workspaceId
    setVersions(data);
  }, [workspaceId, channelKey, langCode]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Use a stable useCallback for loadAudit
  const loadAudit = useCallback(async () => {
    if (!workspaceId || !channelKey) return; // Added workspaceId check
    const data = await fetchChannelDocAuditLogs(workspaceId, channelKey, 20); // Used workspaceId
    setAuditLogs(data);
  }, [workspaceId, channelKey]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  useEffect(() => {
    if (!languages.find((l) => l.lang_code === langCode)) {
      addLanguage(langCode).catch(() => undefined);
      refreshLanguages();
    }
  }, [langCode, languages, addLanguage, refreshLanguages]);

  const handleSave = async (status: "draft" | "published") => {
    if (!workspaceId) return; // Added workspaceId check
    setSaving(true);
    try {
      await createChannelDocVersion({
        workspaceId: workspaceId, // Used workspaceId
        channelKey,
        langCode,
        title,
        contentMd: content,
        status,
      });
      const data = await fetchDocVersions(workspaceId, channelKey, langCode); // Used workspaceId
      setVersions(data);
      const latest = await fetchChannelDocAuditLogs(workspaceId, channelKey, 20); // Used workspaceId
      setAuditLogs(latest);
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = async (role: string, field: "can_read" | "can_write", next: boolean) => {
    if (!workspaceId) return; // Added workspaceId check
    const current: ChannelPermission =
      permissions.find((p) => p.role === role) ??
      ({
        workspace_id: workspaceId, // Used workspaceId
        channel_key: channelKey,
        role,
        can_read: false,
        can_write: false,
      } as ChannelPermission);
    await updatePermission({ ...current, [field]: next });
  };

  const toggleLanguagePermission = async (role: string, field: "can_read" | "can_write", next: boolean) => {
    if (!workspaceId) return; // Added workspaceId check
    const current: ChannelLanguagePermission =
      languagePermissions.find((p) => p.role === role && p.lang_code === langCode) ??
      ({
        workspace_id: workspaceId, // Used workspaceId
        channel_key: channelKey,
        lang_code: langCode,
        role,
        can_read: false,
        can_write: false,
      } as ChannelLanguagePermission);
    await updateLanguagePermission({ ...current, [field]: next });
  };

  if (adminLoading) {
    return <div className="p-6">Checking admin access...</div>;
  }
  
  if (!workspaceId) { // Additional check for rendering components that rely on workspaceId
    return <div className="p-6">Loading workspace...</div>;
  }

  if (!isAdmin) {
    return <NotAuthorized />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Channel Documentation</h1>
        <p className="text-muted-foreground">Manage drafts, publish versions, permissions, and audit logs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Channel</Label>
              <Select value={channelKey} onValueChange={setChannelKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Select value={langCode} onValueChange={setLangCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setPreview((p) => !p)}>
                {preview ? "Hide Preview" : "Preview"}
              </Button>
              <Button variant="secondary" disabled={saving} onClick={() => handleSave("draft")}>
                Save Draft
              </Button>
              <Button disabled={saving} onClick={() => handleSave("published")}>
                Publish
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
          </div>

          <div className="space-y-2">
            <Label>Content (Markdown)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[220px]"
              placeholder="Write documentation in Markdown..."
            />
          </div>

          {preview && (
            <div className="rounded-md border p-3 bg-muted/40">
              <MarkdownViewer content={content} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Permissions (Channel)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map((role) => {
              const current = permissions.find((p) => p.role === role);
              return (
                <div key={role} className="flex items-center justify-between border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="font-medium capitalize">{role}</div>
                    <div className="text-xs text-muted-foreground">Channel-level</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Read</span>
                      <Switch
                        checked={current?.can_read ?? false}
                        onCheckedChange={(v) => togglePermission(role, "can_read", v)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Write</span>
                      <Switch
                        checked={current?.can_write ?? false}
                        onCheckedChange={(v) => togglePermission(role, "can_write", v)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions (Language)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ROLES.map((role) => {
              const current = languagePermissions.find((p) => p.role === role && p.lang_code === langCode);
              return (
                <div key={role} className="flex items-center justify-between border rounded-md p-3">
                  <div className="space-y-1">
                    <div className="font-medium capitalize">
                      {role} <Badge variant="outline">{langCode.toUpperCase()}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">Language-level</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Read</span>
                      <Switch
                        checked={current?.can_read ?? false}
                        onCheckedChange={(v) => toggleLanguagePermission(role, "can_read", v)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Write</span>
                      <Switch
                        checked={current?.can_write ?? false}
                        onCheckedChange={(v) => toggleLanguagePermission(role, "can_write", v)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && <div className="text-sm text-muted-foreground">No versions yet.</div>}
          {versions.map((v) => (
            <div key={`${v.lang_code}-${v.version}`} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium">
                  {v.title || "Untitled"} <Badge variant="outline">v{v.version}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.lang_code?.toUpperCase()} • {v.status} • {new Date(v.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">Last 20 actions.</div>
          <Separator />
          {auditLogs.length === 0 && <div className="text-sm text-muted-foreground">No audit events yet.</div>}
          {auditLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <div className="font-medium capitalize">{log.action}</div>
                <div className="text-xs text-muted-foreground">
                  {log.channel_key} • {log.lang_code?.toUpperCase() ?? "N/A"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
