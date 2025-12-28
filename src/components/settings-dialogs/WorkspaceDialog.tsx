import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import WorkspaceDialogContent from "./WorkspaceDialogContent"; // Assuming this will be created

export default function WorkspaceDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Workspace Settings</DialogTitle>
          <DialogDescription>
            Manage your current workspace settings.
          </DialogDescription>
        </DialogHeader>
        <WorkspaceDialogContent onOpenChange={onOpenChange} /> {/* Pass onOpenChange to content */}
      </DialogContent>
    </Dialog>
  );
}
