"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <Heart className="h-5 w-5" />
        Reactions
      </h2>
      <div className="flex gap-2 flex-wrap">
        {REACTION_TYPES.map((type) => {
          const count = idea.reactionCounts[type] || 0;
          const isActive = idea.userReactions.includes(type);
          return (
            <Button
              key={type}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => void handleToggle(type)}
              className={`gap-1.5 transition-all active:scale-90 ${
                isActive ? "animate-bounce-in" : "hover:scale-105"
              }`}
            >
              <span>{REACTION_EMOJI[type]}</span>
              <span className="text-xs">{count}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
