import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Account() {
  const [name, setName] = useState("Alex Johnson");
  const [email, setEmail] = useState("alex@example.com");

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, security, and account controls.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile information</CardTitle>
          <CardDescription>Update your personal details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">A</AvatarFallback>
            </Avatar>
            <div className="space-y-2 flex-1 max-w-sm">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button disabled className="w-fit">Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Choose the email used for notifications and login.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-sm">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button disabled className="w-fit">Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-step verification</CardTitle>
          <CardDescription>Secure your account with an authenticator app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Authenticator App</p>
              <p className="text-xs text-muted-foreground">Scan the QR code with your authenticator when enabled.</p>
            </div>
            <Button variant="outline" disabled>Set up</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Deleting your account will remove data permanently.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>Delete account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
