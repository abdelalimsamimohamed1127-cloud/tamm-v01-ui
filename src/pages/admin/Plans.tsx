import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/admin/DataTable";
import { useToast } from "@/hooks/use-toast";
import { createPlan, getAllPlans, togglePlanActive, updatePlan } from "@/services/plans";
import { Pencil, Plus } from "lucide-react";

import type { Plan } from "@/services/plans";

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function AdminPlans() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);

  const [name, setName] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [monthlyCredits, setMonthlyCredits] = useState("");
  const [paymobPlanId, setPaymobPlanId] = useState("");
  const [features, setFeatures] = useState("{\n  \"agents\": 1,\n  \"upload_limit\": 5\n}");

  const resetForm = () => {
    setName("");
    setPriceMonthly("");
    setMonthlyCredits("");
    setPaymobPlanId("");
    setFeatures("{}");
  };

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await getAllPlans();
      setPlans(data);
    } catch (e: any) {
      toast({
        title: "Failed to load plans",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setPriceMonthly(String(editing.price_monthly));
      setMonthlyCredits(String(editing.monthly_credits));
      setPaymobPlanId(editing.paymob_plan_id ?? "");
      setFeatures(JSON.stringify(editing.features ?? {}, null, 2));
    } else {
      resetForm();
    }
  }, [editing]);

  const handleSubmit = async () => {
    let parsedFeatures: Record<string, any> = {};
    try {
      parsedFeatures = features?.trim() ? JSON.parse(features) : {};
    } catch (e: any) {
      toast({
        title: "Invalid features JSON",
        description: e?.message ?? "Please provide valid JSON.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updatePlan(editing.id, {
          name,
          price_monthly: Number(priceMonthly),
          monthly_credits: Number(monthlyCredits),
          paymob_plan_id: paymobPlanId || null,
          features: parsedFeatures,
        });
        toast({ title: "Plan updated" });
      } else {
        await createPlan({
          name,
          price_monthly: Number(priceMonthly),
          monthly_credits: Number(monthlyCredits),
          paymob_plan_id: paymobPlanId || null,
          features: parsedFeatures,
        });
        toast({ title: "Plan created" });
      }
      setDialogOpen(false);
      setEditing(null);
      loadPlans();
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, next: boolean) => {
    setTogglingId(id);
    try {
      await togglePlanActive(id, next);
      setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: next } : p)));
      toast({ title: next ? "Plan activated" : "Plan deactivated" });
    } catch (e: any) {
      toast({
        title: "Toggle failed",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const rows = useMemo(() => plans, [plans]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans & Pricing</h1>
          <p className="text-muted-foreground">Manage SaaS plans available to workspaces.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Create Plan
        </Button>
      </div>

      <DataTable<Plan>
        rows={rows}
        empty={loading ? "Loading…" : "No plans yet"}
        columns={[
          { key: "name", header: "Name" },
          { key: "price_monthly", header: "Price", render: (r) => formatPrice(r.price_monthly) },
          { key: "monthly_credits", header: "Credits" },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <Badge variant={r.is_active ? "secondary" : "outline"}>
                {r.is_active ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditing(r);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Active</span>
                  <Switch
                    checked={r.is_active}
                    disabled={togglingId === r.id}
                    onCheckedChange={(checked) => handleToggle(r.id, checked)}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pro"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Monthly Price (cents)</Label>
              <Input
                id="price"
                type="number"
                value={priceMonthly}
                onChange={(e) => setPriceMonthly(e.target.value)}
                placeholder="2900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="credits">Monthly Credits</Label>
              <Input
                id="credits"
                type="number"
                value={monthlyCredits}
                onChange={(e) => setMonthlyCredits(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="paymob">Paymob Plan ID (optional)</Label>
              <Input
                id="paymob"
                value={paymobPlanId}
                onChange={(e) => setPaymobPlanId(e.target.value)}
                placeholder="plan_123"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="features">Features (JSON)</Label>
              <Textarea
                id="features"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Provide a JSON object describing feature limits.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
