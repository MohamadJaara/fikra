"use client";

import { Badge } from "@/components/ui/badge";
import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_COLORS,
  STATUS_LABELS,
  TEAM_SIZE_LABELS,
  type Status,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaListItem } from "@/lib/types";
import { Users, Package, Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { UserLink, UserAvatar } from "@/components/UserLink";

export function IdeaExpandedRow({ idea }: { idea: IdeaListItem }) {
  const roleLabels = useRolesMap();
  const ideaHref = `/product/ideas/${idea._id}`;

  return (
    <div className="relative rounded-lg border hover:bg-muted/30 transition-colors duration-150 group">
      <Link
        href={ideaHref}
        aria-label={`View idea: ${idea.title}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <div className="relative z-10 pointer-events-none px-5 py-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base leading-tight">
              {idea.title}
            </h3>
            {idea.categoryName && (
              <Badge variant="outline" className="text-[11px]">
                {idea.categoryName}
              </Badge>
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
                className="text-[11px] text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950"
              >
                <MapPin className="h-3 w-3 mr-0.5" />
                On-site
              </Badge>
            )}
            {idea.isMember && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                Joined
              </Badge>
            )}
            {idea.isInterested && !idea.isMember && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                Interested
              </Badge>
            )}
            {idea.isOwner && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Owner
              </Badge>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {idea.pitch}
        </p>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-0.5">
          <span
            className={`flex items-center gap-1.5 ${idea.ownerHandle ? "pointer-events-auto" : ""}`}
          >
            <UserAvatar
              handle={idea.ownerHandle}
              image={idea.ownerImage}
              name={idea.ownerName}
            />
            <UserLink
              handle={idea.ownerHandle}
              name={idea.ownerName}
              className={idea.ownerHandle ? "pointer-events-auto" : ""}
            />
          </span>

          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {idea.memberCount} {idea.memberCount === 1 ? "member" : "members"}
            <span className="text-muted-foreground/60">
              ({TEAM_SIZE_LABELS[idea.teamSize]})
            </span>
          </span>

          {idea.missingRoles.length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              {idea.missingRoles.slice(0, 5).map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950"
                >
                  {roleLabels[role] || role}
                </Badge>
              ))}
              {idea.missingRoles.length > 5 && (
                <span className="text-[10px]">+{idea.missingRoles.length - 5}</span>
              )}
            </span>
          )}

          {idea.resourceRequests.filter((r) => !r.resolved).length > 0 && (
            <span className="flex items-center gap-1 flex-wrap">
              {idea.resourceRequests
                .filter((r) => !r.resolved)
                .slice(0, 3)
                .map((r) => (
                  <Badge
                    key={r.tag}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950"
                  >
                    <Package className="h-2.5 w-2.5 mr-0.5" />
                    {r.resourceName}
                  </Badge>
                ))}
              {idea.resourceRequests.filter((r) => !r.resolved).length > 3 && (
                <span className="text-[10px]">
                  +{idea.resourceRequests.filter((r) => !r.resolved).length - 3}
                </span>
              )}
            </span>
          )}

          <span className="flex items-center gap-1.5 ml-auto">
            {REACTION_TYPES.map((type) => {
              const count = idea.reactionCounts[type] || 0;
              if (count === 0) return null;
              const isActive = idea.userReactions.includes(type);
              return (
                <span
                  key={type}
                  className={`text-xs ${isActive ? "font-medium" : ""}`}
                >
                  {REACTION_EMOJI[type]} {count}
                </span>
              );
            })}
            {idea.interestCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Heart className="h-3 w-3" />
                {idea.interestCount}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
