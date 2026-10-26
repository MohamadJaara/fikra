"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IdeaViewMode } from "@/components/ideas/IdeaCollection";
import { cn } from "@/lib/utils";

export function IdeaViewToggle({
  value,
  onChange,
  compact = false,
  className,
}: {
  value: IdeaViewMode;
  onChange: (value: IdeaViewMode) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Idea view"
      className={cn("flex border rounded-md", className)}
    >
      <Button
        type="button"
        variant={value === "list" ? "secondary" : "ghost"}
        size="icon"
        className={cn("rounded-r-none", compact ? "h-8 w-8" : "h-9 w-9")}
        onClick={() => onChange("list")}
        aria-label="List view"
        aria-pressed={value === "list"}
      >
        <List className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
      <Button
        type="button"
        variant={value === "masonry" ? "secondary" : "ghost"}
        size="icon"
        className={cn("rounded-l-none", compact ? "h-8 w-8" : "h-9 w-9")}
        onClick={() => onChange("masonry")}
        aria-label="Masonry view"
        aria-pressed={value === "masonry"}
      >
        <LayoutGrid className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
    </div>
  );
}
