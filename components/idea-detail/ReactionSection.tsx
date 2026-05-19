"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { REACTION_EMOJI, REACTION_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import type { IdeaDetail } from "@/lib/types";

export function ReactionSection({
  idea,
  ideaId,
}: {
  idea: IdeaDetail;
  ideaId: Id<"ideas">;
}) {
  const toggleMutation = useMutation(api.reactions.toggle);

  const handleToggle = async (type: string) => {
    try {
      await toggleMutation({ ideaId, type });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to react");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {REACTION_TYPES.map((type) => {
        const count = idea.reactionCounts[type] || 0;
        const isActive = idea.userReactions.includes(type);
        return (
          <button
            key={type}
            onClick={() => void handleToggle(type)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all active:scale-95 border ${
              isActive
                ? "border-foreground/20 bg-foreground/5 text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            <span className="text-base leading-none">{REACTION_EMOJI[type]}</span>
            {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
