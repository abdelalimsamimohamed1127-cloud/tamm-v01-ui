import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata.full_name || "Alex Johnson");
  const [email, setEmail] = useState(user?.email || "alex@example.com");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full flex flex-col sm:h-[90vh]">
        <DialogHeader>
          <DialogTitle>Account Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, security, and account controls.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-auto p-1 pr-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile information</CardTitle>
                <CardDescription>Update your personal details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-xl">{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2 flex-1 max-w-sm">
                    <p className="text-sm font-medium">Display Name</p>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6">
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email</CardTitle>
                <CardDescription>Your email address is used for login and notifications.</CardDescription>
              </CardHeader>
              <CardContent>
                <Input type="email" value={email} readOnly disabled />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-step verification</CardTitle>
                <CardDescription>Secure your account with an authenticator app.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">Scan a QR code with your authenticator app.</p>
                  </div>
                  <Button variant="outline" disabled>Set up</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Deleting your account will remove data permanently.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-between items-center">
                 <p className="text-sm font-medium">Delete your account</p>
                <Button variant="destructive" disabled>Delete account</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
