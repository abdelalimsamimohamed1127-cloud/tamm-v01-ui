import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { sb } from "@/lib/admin/sb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Row = {
  id: string;
  workspace_id: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  created_at: string;
};

export default function AdminBilling() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const { data } = await sb
          .from("subscriptions")
          .select("id,workspace_id,status,current_period_end,stripe_customer_id,created_at")
          .order("created_at", { ascending: false })
          .limit(200);

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
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Stripe subscription sync (requires subscriptions table + webhook).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stripe integration checklist</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>1) Create subscriptions table (migration included)</div>
          <div>2) Deploy edge function: stripe-webhook (TODO)</div>
          <div>3) Add webhook endpoint in Stripe dashboard</div>
        </CardContent>
      </Card>

      <DataTable<Row>
        rows={rows}
        empty={loading ? "Loading…" : "No subscriptions (apply migrations first)"}
        columns={[
          { key: "workspace_id", header: "Workspace", className:"font-mono text-xs" },
          { key: "status", header: "Status", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
          { key: "current_period_end", header: "Period End", render: (r) => (r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—") },
          { key: "stripe_customer_id", header: "Customer", render: (r) => r.stripe_customer_id ?? "—" },
        ]}
      />
    </div>
  );
}
