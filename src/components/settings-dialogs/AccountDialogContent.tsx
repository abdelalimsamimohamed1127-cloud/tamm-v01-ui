import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client'; // Import supabase

export default function AccountDialogContent() {
  const { user, refreshUserProfile } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial profile data on mount
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          throw error;
        }

        if (isMounted) {
          setDisplayName(data?.display_name || user.user_metadata?.full_name || user.email || '');
        }
      } catch (e: any) {
        console.error("Error fetching profile:", e.message);
        toast({
          title: "Error",
          description: `Failed to load profile: ${e.message}`,
          variant: "destructive",
        });
      }
    };
    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user, toast]); // Re-run if user changes

  const handleSaveProfile = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update your profile.",
        variant: "destructive",
      });
      return;
    }

    if (!displayName.trim()) {
      toast({
        title: "Validation Error",
        description: "Display name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, display_name: displayName.trim() },
          { onConflict: 'id' } // Specify conflict target for upsert
        );

      if (error) {
        throw error;
      }

      // Sync Auth Context
      await refreshUserProfile();

      toast({
        title: "Profile Updated",
        description: "Your display name has been saved successfully.",
      });

    } catch (e: any) {
      console.error("Error saving profile:", e.message);
      toast({
        title: "Failed to save profile",
        description: e.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl">
      <ScrollArea className="h-[70vh] pr-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Account Settings</h2> {/* Updated title */}
            <p className="text-sm text-muted-foreground">Manage your account details.</p>
          </div>

          <Card className="p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="displayName">Display name</Label> {/* Changed to Label */}
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">This is shown in your workspace.</p>
              </div>

              {/* Removed Email input and related elements as per prompt */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""} // Display current user email as read-only
                  disabled // Email is read-only
                  type="email"
                />
                <p className="text-xs text-muted-foreground">Email used for login (read-only).</p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Removed Reset button as it's not relevant */}
                <Button onClick={handleSaveProfile} disabled={isLoading || !displayName.trim()}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Danger zone</h3>
                <p className="text-sm text-muted-foreground">Sensitive actions will be added later.</p>
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
      </ScrollArea>
    </div>
  );
}
