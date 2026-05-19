"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bookmark, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar, UserLink } from "@/components/UserLink";
import { STATUS_COLORS, STATUS_LABELS, type Status } from "@/lib/constants";
import type { IdeaDetail } from "@/lib/types";
import { timeAgo } from "./shared";

export function IdeaHeader({ idea }: { idea: IdeaDetail }) {
  const toggleBookmark = useMutation(api.bookmarks.toggle);
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false);
  const [justBookmarked, setJustBookmarked] = useState(false);

  const handleToggleBookmark = async () => {
    setIsTogglingBookmark(true);
    try {
      const result = await toggleBookmark({ ideaId: idea._id });
      if (result) {
        setJustBookmarked(true);
        setTimeout(() => setJustBookmarked(false), 600);
      }
    } catch {
    } finally {
      setIsTogglingBookmark(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold">{idea.title}</h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggleBookmark}
            disabled={isTogglingBookmark}
            className={`inline-flex items-center justify-center rounded-md p-1.5 transition-all duration-200 ${
              idea.isBookmarked
                ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                : "text-muted-foreground hover:text-amber-500 hover:bg-muted"
            } ${justBookmarked ? "animate-bounce-in" : ""}`}
            aria-label={idea.isBookmarked ? "Remove bookmark" : "Bookmark idea"}
          >
            {isTogglingBookmark ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Bookmark
                className={`h-5 w-5 ${idea.isBookmarked ? "fill-current" : ""}`}
              />
            )}
          </button>
          {idea.categoryName && (
            <Badge variant="outline">{idea.categoryName}</Badge>
          )}
          <Badge
            variant="secondary"
            className={STATUS_COLORS[idea.status as Status] || "bg-muted"}
          >
            {STATUS_LABELS[idea.status as Status] || idea.status}
          </Badge>
          {idea.onsiteOnly && (
            <Badge
              variant="outline"
              className="text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950"
            >
              <MapPin className="h-3 w-3 mr-1" />
              On-site only
            </Badge>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">{idea.pitch}</p>
      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
        <UserAvatar
          handle={idea.ownerHandle}
          image={idea.ownerImage}
          name={idea.ownerName}
          size="md"
        />
        <UserLink handle={idea.ownerHandle} name={idea.ownerName} />
        <span>·</span>
        <span>{timeAgo(idea._creationTime)}</span>
      </div>
    </div>
  );
}
