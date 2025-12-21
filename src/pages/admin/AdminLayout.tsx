import { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Building2, Bot, Activity, CreditCard, ListChecks, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const nav = [
  { to: "/admin/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { to: "/admin/agents", label: "Agents", icon: Bot },
  { to: "/admin/usage", label: "Usage", icon: Activity },
  { to: "/admin/billing", label: "Billing", icon: CreditCard },
  { to: "/admin/audit", label: "Audit Logs", icon: ListChecks },
];

export default function AdminLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-background">
      <div className="grid grid-cols-[260px_1fr] gap-6 p-6">
        <aside className="rounded-xl border bg-card p-3">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold">Tamm Admin</div>
            <div className="text-xs text-muted-foreground">Manage customers & system</div>
          </div>

          <Separator className="my-3" />

          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted",
                      isActive && "bg-primary text-primary-foreground hover:bg-primary"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <Separator className="my-3" />

          <div className="px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-medium text-foreground">Security</div>
                <div className="mt-1">
                  Admin pages must be protected by <span className="font-medium">RLS</span> + <span className="font-medium">RBAC</span>.
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
