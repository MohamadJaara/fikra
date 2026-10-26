"use client";

import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_BORDER_COLORS,
  type Status,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaListItem } from "@/lib/types";
import { Users, Package } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/UserLink";
import { BookmarkButton } from "@/components/BookmarkButton";
import { InterestButton } from "@/components/InterestButton";
import { IdeaStatusDot, IdeaStatusLabel } from "@/components/IdeaStatus";

export function IdeaMasonryItem({
  idea,
  href,
}: {
  idea: IdeaListItem;
  href?: string;
}) {
  const roleLabels = useRolesMap();
  const ideaHref = href ?? `/product/ideas/${idea._id}`;

  const hasReactions = Object.values(idea.reactionCounts).some((c) => c > 0);
  const hasRoles = idea.missingRoles.length > 0;
  const unresolvedResources = idea.resourceRequests.filter((r) => !r.resolved);
  const hasResources = unresolvedResources.length > 0;
  const density =
    idea.memberCount +
    idea.interestCount +
    Object.values(idea.reactionCounts).reduce((a, b) => a + b, 0);
  const showFullMeta = density >= 4;
  const pitchLines = showFullMeta ? "line-clamp-3" : "line-clamp-2";

  return (
    <div
      className={`break-inside-avoid mb-3 pl-4 py-4 border-l-2 ${
        STATUS_BORDER_COLORS[idea.status as Status] || "border-l-muted"
      } group relative transition-colors`}
    >
      <Link
        href={ideaHref}
        aria-label={`View idea: ${idea.title}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm"
      />

      <div className="relative z-10 pointer-events-none space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug">{idea.title}</h3>
          <IdeaStatusDot status={idea.status} decorative className="mt-1.5" />
        </div>

        <p
          className={`text-xs text-muted-foreground leading-relaxed ${pitchLines}`}
        >
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

          <span className="text-muted-foreground/50">
            <IdeaStatusLabel status={idea.status} />
          </span>

          {idea.categoryName && (
            <span className="text-muted-foreground/60">
              {idea.categoryName}
            </span>
          )}

          {idea.isMember && (
            <span className="font-medium text-foreground/60">Joined</span>
          )}
          {idea.isOwner && (
            <span className="font-medium text-foreground/60">Owner</span>
          )}
        </div>

        {(hasRoles || hasResources) && showFullMeta && (
          <div className="flex flex-wrap gap-1 text-[10px]">
            {hasRoles &&
              idea.missingRoles.slice(0, 3).map((role) => (
                <span
                  key={role}
                  className="text-amber-600 dark:text-amber-400 font-medium"
                >
                  {roleLabels[role] || role}
                </span>
              ))}
            {hasRoles && idea.missingRoles.length > 3 && (
              <span className="text-muted-foreground">
                +{idea.missingRoles.length - 3}
              </span>
            )}
            {hasResources &&
              unresolvedResources.slice(0, 2).map((r) => (
                <span
                  key={r.tag}
                  className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-medium"
                >
                  <Package className="h-2.5 w-2.5" />
                  {r.resourceName}
                </span>
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

          <span className="flex items-center gap-1">
            <BookmarkButton
              ideaId={idea._id}
              isBookmarked={idea.isBookmarked}
            />
            <InterestButton idea={idea} />
          </span>
        </div>
      </div>
    </div>
  );
}
