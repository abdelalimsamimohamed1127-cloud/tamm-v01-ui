import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { sb } from "@/lib/admin/sb";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  name: string;
  plan: string;
  owner_id: string;
  created_at: string;
};

export default function AdminWorkspaces() {
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [planChoice, setPlanChoice] = useState<Record<string,string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

async function updatePlan(workspaceId: string, tier: string) {
  setUpdatingId(workspaceId);
  const { data, error } = await supabase.functions.invoke('admin_set_plan_tier', {
    body: { workspace_id: workspaceId, plan_tier: tier },
  });
  setUpdatingId(null);
  if (error) {
    alert(error.message);
    return;
  }
  // refresh
  const { data: fresh } = await sb.from('workspaces').select('id,name,plan,owner_id,created_at').order('created_at', { ascending: false });
  if (fresh) setRows(fresh as any);
  alert(`Updated: ${data?.plan_tier ?? tier}`);
}

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const { data } = await sb
        .from("workspaces")
        .select("id,name,plan,owner_id,created_at")
        .order("created_at", { ascending: false })
        .limit(200);

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
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.plan.toLowerCase().includes(q) || r.owner_id.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <p className="text-muted-foreground">Workspace accounts and their current plan.</p>
      </div>

      <FiltersBar query={query} setQuery={setQuery} placeholder="Search by name / plan / owner_id…" />

      <DataTable<Row>
        rows={filtered}
        empty={loading ? "Loading…" : "No workspaces yet"}
        columns={[
          { key: "name", header: "Workspace" },
          { 
  key: "plan", 
  header: "Plan", 
  render: (r) => (
    <div className="flex items-center gap-2">
      <Badge variant="secondary">{r.plan}</Badge>
      <Select
        value={planChoice[r.id] ?? r.plan}
        onValueChange={(v) => setPlanChoice((p) => ({ ...p, [r.id]: v }))}
      >
        <SelectTrigger className="h-8 w-[110px]">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">free</SelectItem>
          <SelectItem value="paid1">paid1</SelectItem>
          <SelectItem value="paid2">paid2</SelectItem>
          <SelectItem value="paid3">paid3</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={updatingId === r.id}
        onClick={() => updatePlan(r.id, planChoice[r.id] ?? r.plan)}
      >
        {updatingId === r.id ? "Saving..." : "Apply"}
      </Button>
    </div>
  ) 
},
          { key: "owner_id", header: "Owner" , className:"font-mono text-xs"},
          { key: "created_at", header: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
        ]}
      />

      <div className="text-xs text-muted-foreground">
        TODO: show subscription status (Stripe) and usage totals per workspace.
      </div>
    </div>
  );
}
