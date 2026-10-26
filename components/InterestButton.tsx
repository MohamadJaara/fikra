"use client";

import { api } from "@/convex/_generated/api";
import type { IdeaListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Heart, Loader2 } from "lucide-react";
import { useState, type MouseEvent } from "react";
import { toast } from "sonner";

export function InterestButton({
  idea,
  className,
}: {
  idea: Pick<
    IdeaListItem,
    "_id" | "isInterested" | "isMember" | "interestCount"
  >;
  className?: string;
}) {
  const expressInterest = useMutation(api.interest.express);
  const removeInterest = useMutation(api.interest.remove);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsToggling(true);
    try {
      if (idea.isInterested) {
        await removeInterest({ ideaId: idea._id });
      } else {
        await expressInterest({ ideaId: idea._id });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update interest",
      );
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isToggling || idea.isMember}
      aria-label={idea.isInterested ? "Remove interest" : "Express interest"}
      aria-pressed={idea.isInterested}
      className={cn(
        "pointer-events-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors text-xs",
        idea.isInterested
          ? "text-rose-500 font-medium"
          : "text-muted-foreground hover:text-rose-400",
        idea.isMember
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer hover:bg-muted/60",
        className,
      )}
    >
      {isToggling ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Heart
          className={cn("h-3.5 w-3.5", idea.isInterested && "fill-current")}
        />
      )}
      {idea.interestCount > 0 && <span>{idea.interestCount}</span>}
    </button>
  );
}
