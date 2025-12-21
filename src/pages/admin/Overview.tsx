import { useEffect, useState } from "react";
import { StatCard } from "@/components/admin/StatCard";
import { sb } from "@/lib/admin/sb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminOverview() {
  const [stats, setStats] = useState({
    users: 0,
    workspaces: 0,
    agents: 0,
    subscriptions: 0,
    auditEvents: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Best-effort counts. Some tables might not exist yet until you apply migrations.
      const safeCount = async (table: string) => {
        try {
          const { count } = await sb.from(table).select("*", { count: "exact", head: true });
          return count ?? 0;
        } catch {
          return 0;
        }
      };

      const [users, workspaces, agents, subscriptions, auditEvents] = await Promise.all([
        safeCount("profiles"),
        safeCount("workspaces"),
        safeCount("agents"),
        safeCount("subscriptions"),
        safeCount("audit_logs"),
      ]);

      if (!cancelled) setStats({ users, workspaces, agents, subscriptions, auditEvents });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground">High-level visibility into your SaaS.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Users" value={stats.users} />
        <StatCard title="Workspaces" value={stats.workspaces} />
        <StatCard title="Agents" value={stats.agents} />
        <StatCard title="Subscriptions" value={stats.subscriptions} hint="Apply Stripe migrations to enable" />
        <StatCard title="Audit Events" value={stats.auditEvents} hint="Tracks actions + errors" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>• Apply the admin SQL migrations (user_roles, subscriptions, usage_events, audit_logs) to unlock full admin functionality.</div>
          <div>• Enable RLS policies so only admins can access admin tables.</div>
          <div>• Add Stripe webhook (edge function) to sync subscription status automatically.</div>
        </CardContent>
      </Card>
    </div>
  );
}
