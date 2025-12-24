import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  WorkspaceGeneralSettingsCard,
  WorkspaceMembersSettingsCard,
  WorkspacePlansSettingsCard,
} from "@/components/workspace/WorkspaceSettingsSections";
import {
  getWalletBalance,
  getWorkspaceSubscription,
  type WalletBalance,
  type WorkspaceSubscription,
} from "@/services/billing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  past_due: "bg-amber-100 text-amber-800 border-amber-200",
  canceled: "bg-rose-100 text-rose-800 border-rose-200",
  trialing: "bg-blue-100 text-blue-800 border-blue-200",
};

type TabValue = "general" | "members" | "billing";

export default function WorkspaceDialogContent() {
  const { workspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabValue>("general");
  const [subscription, setSubscription] = useState<WorkspaceSubscription | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBillingLoaded(false);
    setSubscription(null);
    setWallet(null);
  }, [workspace?.id]);

  useEffect(() => {
    const loadBilling = async () => {
      if (!workspace?.id || billingLoaded) return;

      setIsLoadingBilling(true);
      setError(null);

      try {
        const [subscriptionData, walletData] = await Promise.all([
          getWorkspaceSubscription(workspace.id),
          getWalletBalance(workspace.id),
        ]);

        setSubscription(subscriptionData);
        setWallet(walletData);
        setBillingLoaded(true);
      } catch (err) {
        setError("Unable to load billing data.");
        setBillingLoaded(false);
      } finally {
        setIsLoadingBilling(false);
      }
    };

    if (activeTab === "billing") {
      void loadBilling();
    }
  }, [activeTab, workspace?.id, billingLoaded]);

  const formattedRenewalDate = useMemo(() => {
    if (!subscription?.currentPeriodEnd) return null;
    return new Date(subscription.currentPeriodEnd).toLocaleDateString();
  }, [subscription]);

  const balanceProgress = useMemo(() => {
    if (!wallet || !subscription?.monthlyCredits || subscription.monthlyCredits <= 0) return 0;
    return Math.min((wallet.balance / subscription.monthlyCredits) * 100, 100);
  }, [wallet, subscription]);

  return (
    <div className="w-full max-w-3xl">
      <ScrollArea className="h-[70vh] pr-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Workspace settings</h2>
            <p className="text-sm text-muted-foreground">
              Manage workspace identity, members, plans, and billing (UI only).
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabValue)} className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="pt-4">
              <div className="space-y-4">
                <WorkspaceGeneralSettingsCard />
                <WorkspacePlansSettingsCard />
              </div>
            </TabsContent>

            <TabsContent value="members" className="pt-4">
              <WorkspaceMembersSettingsCard />
            </TabsContent>

            <TabsContent value="billing" className="pt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Current Plan</CardTitle>
                      <CardDescription>Billing status is read-only.</CardDescription>
                    </div>
                    <Button disabled>Upgrade Plan</Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold">
                            {subscription?.planName ?? "No plan assigned"}
                          </p>
                          {subscription && (
                            <Badge
                              variant="outline"
                              className={statusStyles[subscription.status] ?? ""}
                            >
                              {subscription.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        {formattedRenewalDate && (
                          <p className="text-sm text-muted-foreground">
                            Renews on {formattedRenewalDate}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-start sm:items-end">
                        <p className="text-sm text-muted-foreground">Monthly credits</p>
                        <p className="text-2xl font-semibold">
                          {subscription ? subscription.monthlyCredits.toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle>Credit Balance</CardTitle>
                      <CardDescription>Usage is tracked per workspace.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {isLoadingBilling ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-40" />
                          <Skeleton className="h-2 w-full" />
                        </div>
                      ) : (
                        <>
                          <p className="text-3xl font-semibold">
                            {wallet ? wallet.balance.toLocaleString() : "—"} Credits
                          </p>
                          {subscription?.monthlyCredits ? (
                            <div className="space-y-2">
                              <Progress value={balanceProgress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {wallet?.balance.toLocaleString() ?? 0} / {subscription.monthlyCredits.toLocaleString()} credits used
                              </p>
                            </div>
                          ) : null}
                        </>
                      )}
                      <Button variant="outline" disabled className="w-full">
                        Top Up
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Last 5 ledger entries.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingBilling ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, index) => (
                            <Skeleton key={index} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : wallet && wallet.recentTransactions.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {wallet.recentTransactions.map((transaction) => (
                              <TableRow key={transaction.id}>
                                <TableCell>
                                  {new Date(transaction.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="capitalize">{transaction.type}</TableCell>
                                <TableCell className="text-right">
                                  {transaction.amount > 0 ? "+" : ""}
                                  {transaction.amount.toLocaleString()} {wallet.currency}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No transactions yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
