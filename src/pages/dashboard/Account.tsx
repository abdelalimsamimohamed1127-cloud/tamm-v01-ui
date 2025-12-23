import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * UI-only Account page (Chatbase-style)
 * - No backend changes in this task
 * - Safe: does not touch layout/routes besides rendering inside Dashboard
 */
export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();

  const initialEmail = useMemo(() => user?.email ?? "", [user?.email]);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    setSaving(true);
    try {
      // Placeholder (wire later)
      toast({
        title: "Saved",
        description: "Account settings saved (UI-only for now).",
      });
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account details.
        </p>
      </div>

      <Card className="p-6">
        <div className="grid gap-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
            <p className="text-xs text-muted-foreground">
              This is shown in your workspace.
            </p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              type="email"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Email used for login.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setDisplayName("");
              setEmail(initialEmail);
            }} disabled={saving}>
              Reset
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Danger zone</h2>
            <p className="text-sm text-muted-foreground">
              Sensitive actions will be added later.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled>
              Delete account
            </Button>
            <Button variant="destructive" disabled>
              Logout everywhere
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
