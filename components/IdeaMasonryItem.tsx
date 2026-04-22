"use client";

import { Badge } from "@/components/ui/badge";
import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_BORDER_COLORS,
  STATUS_LABELS,
  type Status,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaListItem } from "@/lib/types";
import { Users, Package, Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/UserLink";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";

export function IdeaMasonryItem({ idea }: { idea: IdeaListItem }) {
  const roleLabels = useRolesMap();
  const ideaHref = `/product/ideas/${idea._id}`;
  const expressInterest = useMutation(api.interest.express);
  const removeInterest = useMutation(api.interest.remove);
  const [isToggling, setIsToggling] = useState(false);

  const hasReactions = Object.values(idea.reactionCounts).some((c) => c > 0);
  const hasRoles = idea.missingRoles.length > 0;
  const hasResources = idea.resourceRequests.filter((r) => !r.resolved).length > 0;
  const density = idea.memberCount + idea.interestCount + Object.values(idea.reactionCounts).reduce((a, b) => a + b, 0);
  const showFullMeta = density >= 4;
  const pitchLines = showFullMeta ? "line-clamp-3" : "line-clamp-2";

  const handleToggleInterest = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsToggling(true);
    try {
      if (idea.isInterested) {
        await removeInterest({ ideaId: idea._id });
      } else {
        await expressInterest({ ideaId: idea._id });
      }
    } catch {
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      className={`break-inside-avoid mb-4 pl-4 py-3 border-l-[3px] ${
        STATUS_BORDER_COLORS[idea.status as Status] || "border-l-muted"
      } group relative`}
    >
      <Link
        href={ideaHref}
        aria-label={`View idea: ${idea.title}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm"
      />

      <div className="relative z-10 pointer-events-none space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug">
            {idea.title}
          </h3>
          <span
            className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
              STATUS_LABELS[idea.status as Status]
                ? "text-muted-foreground bg-muted/60"
                : ""
            }`}
          >
            {STATUS_LABELS[idea.status as Status] || idea.status}
          </span>
        </div>

        <p className={`text-xs text-muted-foreground leading-relaxed ${pitchLines}`}>
          {idea.pitch}
        </p>

        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 pointer-events-auto">
            <UserAvatar
              handle={idea.ownerHandle}
              image={idea.ownerImage}
              name={idea.ownerName}
            />
            <span className="truncate max-w-[80px]">{idea.ownerName}</span>
          </span>

          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {idea.memberCount}
          </span>

          {idea.categoryName && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {idea.categoryName}
            </Badge>
          )}

          {idea.onsiteOnly && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 font-normal text-blue-600 border-blue-300 dark:text-blue-300 dark:border-blue-700"
            >
              On-site
            </Badge>
          )}

          {idea.isMember && (
            <span className="text-[10px] font-medium text-primary">Joined</span>
          )}
          {idea.isOwner && (
            <span className="text-[10px] font-medium text-muted-foreground">Owner</span>
          )}
        </div>

        {(hasRoles || hasResources) && showFullMeta && (
          <div className="flex flex-wrap gap-1">
            {hasRoles &&
              idea.missingRoles.slice(0, 3).map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 text-orange-600 border-orange-300 bg-orange-50/50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950/50"
                >
                  {roleLabels[role] || role}
                </Badge>
              ))}
            {hasRoles && idea.missingRoles.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{idea.missingRoles.length - 3}
              </span>
            )}
            {hasResources &&
              idea.resourceRequests
                .filter((r) => !r.resolved)
                .slice(0, 2)
                .map((r) => (
                  <Badge
                    key={r.tag}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 text-blue-600 border-blue-300 bg-blue-50/50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/50"
                  >
                    <Package className="h-2.5 w-2.5 mr-0.5" />
                    {r.resourceName}
                  </Badge>
                ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {hasReactions ? (
            <span className="flex items-center gap-1.5">
              {REACTION_TYPES.map((type) => {
                const count = idea.reactionCounts[type] || 0;
                if (count === 0) return null;
                return (
                  <span key={type} className="text-[11px]">
                    {REACTION_EMOJI[type]} {count}
                  </span>
                );
              })}
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={handleToggleInterest}
            disabled={isToggling || idea.isMember || idea.isOwner}
            className={`pointer-events-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors text-xs ${
              idea.isInterested
                ? "text-rose-500 font-medium"
                : "text-muted-foreground hover:text-rose-400"
            } ${
              idea.isMember || idea.isOwner
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer hover:bg-muted/60"
            }`}
            aria-label={idea.isInterested ? "Remove interest" : "Express interest"}
          >
            {isToggling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart
                className={`h-3.5 w-3.5 ${idea.isInterested ? "fill-current" : ""}`}
              />
            )}
            {idea.interestCount > 0 && <span>{idea.interestCount}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
