import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getBillingSnapshot, type BillingSnapshot } from "@/services/billing";

export function WorkspaceGeneralSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
        <CardDescription>Workspace name, ID, and danger actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Workspace name</p>
            <Input value="My Workspace" readOnly />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Workspace ID</p>
            <Input value="ws_123456" readOnly className="bg-muted/70" />
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-destructive">Delete workspace</p>
            <p className="text-xs text-muted-foreground">
              Remove workspace data permanently. Disabled in UI preview.
            </p>
          </div>
          <Button variant="destructive" disabled>
            Delete workspace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceMembersSettingsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Invite or manage workspace collaborators.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Owner</Badge>
            <span className="text-sm font-medium">owner@workspace.com</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Member</Badge>
            <span className="text-sm font-medium">agent@workspace.com</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled>
            Remove member
          </Button>
          <Button disabled>Invite member</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspacePlansSettingsCard() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Plans</CardTitle>
        <CardDescription>Current plan and upgrade options.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pro</p>
              <p className="text-xs text-muted-foreground">Up to 5 agents, priority support</p>
            </div>
            <Badge>Active</Badge>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled>
            Downgrade
          </Button>
          <Button disabled>Upgrade</Button>
        </div>
      </CardContent>
    </Card>
  );
}

type UsageState = "normal" | "warning" | "blocked";

export function WorkspaceBillingSettingsCard() {
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getBillingSnapshot()
      .then(setBilling)
      .finally(() => setIsLoading(false));
  }, []);

  const usageSections = useMemo(() => {
    if (!billing) {
      return [];
    }

    return [
      {
        label: "Messages",
        used: billing.usage.messagesUsed,
        limit: billing.usage.messagesLimit,
      },
      {
        label: "Tokens",
        used: billing.usage.tokensUsed,
        limit: billing.usage.tokensLimit,
      },
    ];
  }, [billing]);

  const getUsageStatus = (used: number, limit: number): { state: UsageState; percent: number } => {
    const percent = limit === 0 ? 0 : (used / limit) * 100;
    if (percent > 100) return { state: "blocked", percent };
    if (percent >= 70) return { state: "warning", percent };
    return { state: "normal", percent };
  };

  const statusStyles: Record<UsageState, { badge: string; progress: string; label: string }> = {
    normal: {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
      progress: "bg-emerald-500",
      label: "Normal",
    },
    warning: {
      badge: "bg-amber-50 text-amber-700 border-amber-100",
      progress: "bg-amber-500",
      label: "Warning",
    },
    blocked: {
      badge: "bg-destructive/10 text-destructive border-destructive/20",
      progress: "bg-destructive",
      label: "Blocked",
    },
  };

  return (
    <Card className="h-full">
      <CardHeader className="gap-4 sm:flex sm:items-center sm:justify-between">
        <div>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Plan summary and usage (read-only).</CardDescription>
        </div>
        <Button disabled={isLoading}>Upgrade Plan</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 sm:flex sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-base font-semibold">
                {billing?.planName ?? "Loading plan..."}
              </p>
              {billing && (
                <Badge variant="secondary" className="w-fit">
                  Billed {billing.billingCycle}
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-3 sm:mt-0 text-right">
            <p className="text-sm text-muted-foreground">Price per month</p>
            <p className="text-2xl font-semibold">
              {billing ? `$${billing.pricePerMonth.toLocaleString()}` : "—"}
              <span className="text-sm font-normal text-muted-foreground"> / month</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Usage overview</p>
            <p className="text-xs text-muted-foreground">Auto refresh soon</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {usageSections.map((section) => {
              const { state, percent } = getUsageStatus(section.used, section.limit);
              const styles = statusStyles[state];

              return (
                <div key={section.label} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{section.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {section.used.toLocaleString()} / {section.limit.toLocaleString()}
                      </p>
                    </div>
                    <Badge className={styles.badge} variant="outline">
                      {styles.label}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.floor(percent)}% used</span>
                      <span>{percent > 100 ? "Over limit" : "Within limit"}</span>
                    </div>
                    <Progress
                      value={Math.min(percent, 120)}
                      indicatorClassName={styles.progress}
                      className="h-2"
                    />
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Loading billing usage...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
