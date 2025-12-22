import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard/settings/general", label: "General" },
  { to: "/dashboard/settings/security", label: "Security" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = useMemo(
    () => (
      <div className="space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "block rounded-md px-3 py-2 text-sm transition hover:bg-muted",
                isActive ? "bg-muted font-semibold" : "text-muted-foreground"
              )
            }
            onClick={() => setOpen(false)}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    ),
    []
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
      <div className="hidden lg:block">
        <Card>
          <CardContent className="pt-4">{nav}</CardContent>
        </Card>
      </div>
      <div className="lg:hidden flex justify-end">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Menu className="h-4 w-4" />
              Settings menu
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xs">
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{nav}</div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="lg:col-span-1 space-y-4">{children}</div>
    </div>
  );
}
