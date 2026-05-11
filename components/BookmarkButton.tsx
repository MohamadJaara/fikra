"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState, useCallback } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  ideaId,
  isBookmarked,
  size = "sm",
  className,
}: {
  ideaId: Id<"ideas">;
  isBookmarked: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const toggleBookmark = useMutation(api.bookmarks.toggle);
  const [isToggling, setIsToggling] = useState(false);
  const [justBookmarked, setJustBookmarked] = useState(false);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsToggling(true);
      try {
        const result = await toggleBookmark({ ideaId });
        if (result) {
          setJustBookmarked(true);
          setTimeout(() => setJustBookmarked(false), 600);
        }
      } catch {
      } finally {
        setIsToggling(false);
      }
    },
    [toggleBookmark, ideaId],
  );

  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const buttonSizeClasses = {
    sm: "px-1.5 py-0.5 rounded text-xs gap-0.5",
    md: "px-2 py-1 rounded-md text-sm gap-1",
    lg: "px-3 py-1.5 rounded-lg text-sm gap-1.5",
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={cn(
        "pointer-events-auto inline-flex items-center transition-all duration-200 cursor-pointer",
        buttonSizeClasses[size],
        isBookmarked
          ? "text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-50 dark:hover:bg-amber-950/50"
          : "text-muted-foreground hover:text-amber-500 hover:bg-muted/60",
        justBookmarked && "animate-bounce-in",
        className,
      )}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark idea"}
    >
      {isToggling ? (
        <Loader2 className={cn(sizeClasses[size], "animate-spin")} />
      ) : (
        <Bookmark
          className={cn(
            sizeClasses[size],
            "transition-transform duration-200",
            isBookmarked && "fill-current",
          )}
        />
      )}
    </button>
  );
}
