import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { sb } from "@/lib/admin/sb";

type Row = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target: string | null;
  metadata: any;
  created_at: string;
};

export default function AdminAuditLogs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const { data } = await sb
          .from("audit_logs")
          .select("id,actor_user_id,action,target,metadata,created_at")
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
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Security + debugging trail. Requires audit_logs table.</p>
      </div>

      <DataTable<Row>
        rows={rows}
        empty={loading ? "Loading…" : "No audit logs (apply migrations first)"}
        columns={[
          { key: "created_at", header: "Time", render: (r) => new Date(r.created_at).toLocaleString() },
          { key: "action", header: "Action" },
          { key: "actor_user_id", header: "Actor", className:"font-mono text-xs", render: (r) => r.actor_user_id ?? "—" },
          { key: "target", header: "Target", render: (r) => r.target ?? "—" },
        ]}
      />
      <div className="text-xs text-muted-foreground">
        TODO: render metadata in a drawer + add filters by action/actor.
      </div>
    </div>
  );
}
