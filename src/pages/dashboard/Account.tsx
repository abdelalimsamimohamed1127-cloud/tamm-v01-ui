import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

export default function Account() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata.full_name || "Alex Johnson");

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>This is how others will see you on the site.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-3xl">{name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-grow space-y-2">
                <p className="text-sm font-medium">Display Name</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
            <Button>Save</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Your email address is used for login and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input type="email" value={user?.email || ''} readOnly disabled className="max-w-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>Add an additional layer of security to your account.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="max-w-sm">
                <p className="text-sm font-medium mb-2">Authenticator App</p>
                <Button variant="outline" disabled>Set up</Button>
                <p className="text-xs text-muted-foreground mt-2">Use an app like Google Authenticator or Authy.</p>
            </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center max-w-sm">
            <div>
                <p className="text-sm font-medium">Delete your account</p>
                <p className="text-xs text-muted-foreground">All your data will be permanently removed.</p>
            </div>
            <Button variant="destructive" disabled>Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
