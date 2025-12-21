import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/admin/DataTable";
import { FiltersBar } from "@/components/admin/FiltersBar";
import { sb } from "@/lib/admin/sb";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export default function AdminCustomers() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const { data } = await sb
        .from("profiles")
        .select("id,email,full_name,created_at")
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
    return rows.filter((r) => (r.email ?? "").toLowerCase().includes(q) || (r.full_name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">Users in your Supabase project (profiles table).</p>
      </div>

      <FiltersBar query={query} setQuery={setQuery} placeholder="Search email or name…" />

      <DataTable<Row>
        rows={filtered}
        empty={loading ? "Loading…" : "No customers yet"}
        columns={[
          { key: "email", header: "Email", render: (r) => r.email ?? <span className="text-muted-foreground">—</span> },
          { key: "full_name", header: "Name", render: (r) => r.full_name ?? <span className="text-muted-foreground">—</span> },
          { key: "created_at", header: "Created", render: (r) => new Date(r.created_at).toLocaleString() },
          {
            key: "status",
            header: "Status",
            render: () => <Badge variant="secondary">unknown</Badge>,
          },
        ]}
      />
      <div className="text-xs text-muted-foreground">
        TODO: Join with subscriptions (Stripe) to show paid / trial / canceled.
      </div>
    </div>
  );
}
