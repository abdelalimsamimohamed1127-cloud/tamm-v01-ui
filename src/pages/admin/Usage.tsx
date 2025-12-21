import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { sb } from "@/lib/admin/sb";

type Row = {
  id: string;
  workspace_id: string;
  type: string;
  quantity: number;
  created_at: string;
};

export default function AdminUsage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const { data } = await sb
          .from("usage_events")
          .select("id,workspace_id,type,quantity,created_at")
          .order("created_at", { ascending: false })
          .limit(300);

        if (!cancelled) setRows((data ?? []) as Row[]);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground">
          Usage events (tokens, ingested MB, messages). Requires the usage_events table.
        </p>
      </div>

      <DataTable<Row>
        rows={rows}
        empty={loading ? "Loading…" : "No usage events (apply migrations first)"}
        columns={[
          { key: "workspace_id", header: "Workspace", className:"font-mono text-xs" },
          { key: "type", header: "Type" },
          { key: "quantity", header: "Qty" },
          { key: "created_at", header: "Time", render: (r) => new Date(r.created_at).toLocaleString() },
        ]}
      />

      <div className="text-xs text-muted-foreground">
        TODO: add daily aggregation views and enforce plan limits inside edge functions.
      </div>
    </div>
  );
}
