import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SettingsSecurity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">Control access and safeguards for your agent.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>Require 2FA for sensitive changes.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Enforce 2FA</p>
            <p className="text-xs text-muted-foreground">Recommended for all owners and admins.</p>
          </div>
          <Switch disabled />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session controls</CardTitle>
          <CardDescription>Manage session length and risk checks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Logout inactive sessions</Label>
              <p className="text-xs text-muted-foreground">Auto-expire sessions after inactivity.</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Device verification</Label>
              <p className="text-xs text-muted-foreground">Prompt for verification on new devices.</p>
            </div>
            <Switch disabled />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" disabled>
              Save security settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
