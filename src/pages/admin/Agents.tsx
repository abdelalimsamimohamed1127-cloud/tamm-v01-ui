import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { sb } from "@/lib/admin/sb";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  name: string;
  workspace_id: string;
  language: string | null;
  updated_at: string;
};

export default function AdminAgents() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const { data } = await sb
        .from("agents")
        .select("id,name,workspace_id,language,updated_at")
        .order("updated_at", { ascending: false })
        .limit(300);

      if (!cancelled) {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.workspace_id.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-muted-foreground">All agents across workspaces.</p>
      </div>

      <FiltersBar query={query} setQuery={setQuery} placeholder="Search agent name / workspace_id…" />

      <DataTable<Row>
        rows={filtered}
        empty={loading ? "Loading…" : "No agents yet"}
        columns={[
          { key: "name", header: "Agent" },
          { key: "workspace_id", header: "Workspace" , className:"font-mono text-xs"},
          { key: "language", header: "Lang", render: (r) => <Badge variant="secondary">{r.language ?? "—"}</Badge> },
          { key: "updated_at", header: "Updated", render: (r) => new Date(r.updated_at).toLocaleString() },
        ]}
      />

      <div className="text-xs text-muted-foreground">
        TODO: show trained/untrained based on knowledge_sources status + last trained_at.
      </div>
    </div>
  );
}
