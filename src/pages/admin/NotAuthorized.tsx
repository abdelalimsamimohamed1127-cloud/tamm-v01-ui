import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NotAuthorized() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="text-2xl font-bold">Not authorized</div>
      <div className="text-muted-foreground text-sm">You don’t have permission to access the admin panel.</div>
      <Button onClick={() => navigate("/dashboard/overview")}>Back to Dashboard</Button>
    </div>
  );
}
