"use client";

import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  TEAM_SIZE_LABELS,
  type Status,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaListItem } from "@/lib/types";
import { Users, Package, Heart, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { UserLink, UserAvatar } from "@/components/UserLink";
import { BookmarkButton } from "@/components/BookmarkButton";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";

export function IdeaExpandedRow({
  idea,
  href,
}: {
  idea: IdeaListItem;
  href?: string;
}) {
  const roleLabels = useRolesMap();
  const ideaHref = href ?? `/product/ideas/${idea._id}`;
  const expressInterest = useMutation(api.interest.express);
  const removeInterest = useMutation(api.interest.remove);
  const [isToggling, setIsToggling] = useState(false);

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

  const hasReactions = Object.values(idea.reactionCounts).some((c) => c > 0);

  return (
    <div className="relative group py-5 first:pt-0">
      <Link
        href={ideaHref}
        aria-label={`View idea: ${idea.title}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-sm"
      />

      <div className="relative z-10 pointer-events-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`mt-2 h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[idea.status as Status] || "bg-zinc-400"}`}
            />
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-snug group-hover:text-foreground/80 transition-colors">
                {idea.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {hasReactions && (
              <span className="flex items-center gap-1.5 mr-1">
                {REACTION_TYPES.map((type) => {
                  const count = idea.reactionCounts[type] || 0;
                  if (count === 0) return null;
                  return (
                    <span key={type} className="text-xs text-muted-foreground">
                      {REACTION_EMOJI[type]}
                      {count}
                    </span>
                  );
                })}
              </span>
            )}
            <BookmarkButton
              ideaId={idea._id}
              isBookmarked={idea.isBookmarked}
            />
            <button
              onClick={handleToggleInterest}
              disabled={isToggling || idea.isMember}
              className={`pointer-events-auto inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors text-xs ${
                idea.isInterested
                  ? "text-rose-500 font-medium"
                  : "text-muted-foreground hover:text-rose-400"
              } ${idea.isMember ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-muted/60"}`}
              aria-label={
                idea.isInterested ? "Remove interest" : "Express interest"
              }
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

        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed pl-5">
          {idea.pitch}
        </p>

        <div className="mt-2.5 flex items-center flex-wrap gap-x-1.5 gap-y-1 pl-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UserAvatar
              handle={idea.ownerHandle}
              image={idea.ownerImage}
              name={idea.ownerName}
            />
            <span
              className={idea.ownerHandle ? "pointer-events-auto" : ""}
            >
              <UserLink
                handle={idea.ownerHandle}
                name={idea.ownerName}
                className={idea.ownerHandle ? "pointer-events-auto" : ""}
              />
            </span>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span>{STATUS_LABELS[idea.status as Status]}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {idea.memberCount}/{TEAM_SIZE_LABELS[idea.teamSize]}
          </span>
          {idea.categoryName && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span>{idea.categoryName}</span>
            </>
          )}
          {idea.onsiteOnly && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                <MapPin className="h-3 w-3" />
                On-site
              </span>
            </>
          )}
          {idea.isMember && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="font-medium text-foreground/70">Joined</span>
            </>
          )}
          {idea.isOwner && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="font-medium text-foreground/70">Owner</span>
            </>
          )}
          {idea.isInterested && !idea.isMember && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-rose-500 font-medium">Interested</span>
            </>
          )}
          {idea.missingRoles.length > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-1 flex-wrap">
                needs{" "}
                {idea.missingRoles.slice(0, 4).map((role, i) => (
                  <span key={role}>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {roleLabels[role] || role}
                    </span>
                    {i < Math.min(idea.missingRoles.length, 4) - 1 && (
                      <span className="text-muted-foreground/30">, </span>
                    )}
                  </span>
                ))}
                {idea.missingRoles.length > 4 && (
                  <span className="text-muted-foreground">
                    {" "}+{idea.missingRoles.length - 4}
                  </span>
                )}
              </span>
            </>
          )}
          {idea.resourceRequests.filter((r) => !r.resolved).length > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="flex items-center gap-0.5">
                <Package className="h-3 w-3" />
                {idea.resourceRequests.filter((r) => !r.resolved).length} resource{idea.resourceRequests.filter((r) => !r.resolved).length !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
