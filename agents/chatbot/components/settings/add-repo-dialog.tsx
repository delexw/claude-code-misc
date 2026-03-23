"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AddRepoDialogProps {
  existingPaths: string[];
  onAdd: (path: string) => void;
}

export function AddRepoDialog({ existingPaths, onAdd }: AddRepoDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [path, setPath] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = path.trim();

    if (!trimmed) {
      setError("Path cannot be empty");
      return;
    }
    if (existingPaths.includes(trimmed)) {
      setError("This repository is already in the list");
      return;
    }

    onAdd(trimmed);
    setPath("");
    setError(null);
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPath("");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="repo-path" className="text-sm font-medium text-on-surface">
              Absolute path
            </label>
            <Input
              id="repo-path"
              placeholder="/Users/you/projects/my-repo"
              value={path}
              onChange={(e) => {
                setPath(e.target.value);
                setError(null);
              }}
              autoFocus
              className="font-mono text-sm"
            />
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
