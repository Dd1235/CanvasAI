"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCanvasSession } from "@/lib/canvasai-api";
import { cn } from "@/lib/utils";

type Props = {
  trigger?: React.ReactNode;
  className?: string;
  onCreated?: (session: { id: string; title: string }) => void;
};

export function NewSessionDialog({ trigger, className, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const trimmed = title.trim();
      const session = await createCanvasSession(trimmed || undefined);
      toast.success("Session created", { description: session.title });
      onCreated?.(session);
      setOpen(false);
      setTitle("");
      router.push(`/dashboard/canvas/${session.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create session.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button 
            size="sm" 
            className={cn(
              "bg-[#0A66C2] text-white hover:bg-[#004182] hover:shadow-[0_0_20px_rgba(10,102,194,0.4)] focus-visible:ring-2 focus-visible:ring-[#0A66C2] focus-visible:outline-none border-0 transition-all duration-300",
              className
            )} 
            title="Create a new canvas session"
          >
            <Plus className="size-4" />
            New session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new canvas session</DialogTitle>
          <DialogDescription>
            Optionally name it. You can rename later from the canvas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="session-title">Topic (optional)</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Binary search trees"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
