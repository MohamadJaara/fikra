"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  REACTION_EMOJI,
  REACTION_TYPES,
  STATUS_COLORS,
  STATUS_LABELS,
  type Status,
} from "@/lib/constants";
import { useRolesMap } from "@/lib/hooks";
import type { IdeaListItem } from "@/lib/types";
import { Users, Package, Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { UserLink, UserAvatar } from "@/components/UserLink";

export function IdeaCard({ idea }: { idea: IdeaListItem }) {
  const roleLabels = useRolesMap();
  const ideaHref = `/product/ideas/${idea._id}`;
  const teamPercent =
    idea.teamSizeWanted > 0
      ? Math.min(100, (idea.memberCount / idea.teamSizeWanted) * 100)
      : 0;

  return (
    <Card className="relative h-full hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer group">
      <Link
        href={ideaHref}
        aria-label={`View idea: ${idea.title}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <div className="relative z-10 pointer-events-none">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-2">
              {idea.title}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
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
            </div>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {idea.pitch}
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={idea.ownerHandle ? "pointer-events-auto" : undefined}
            >
              <UserAvatar
                handle={idea.ownerHandle}
                image={idea.ownerImage}
                name={idea.ownerName}
              />
            </span>
            <UserLink
              handle={idea.ownerHandle}
              name={idea.ownerName}
              className={
                idea.ownerHandle ? "truncate pointer-events-auto" : "truncate"
              }
            />
            {idea.isOwner && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Owner
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {idea.memberCount}/{idea.teamSizeWanted} members
              </span>
              {idea.isMember && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  Joined
                </Badge>
              )}
            </div>
            <Progress value={teamPercent} className="h-1.5" />
          </div>

          {idea.missingRoles.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.missingRoles.slice(0, 4).map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className="text-[11px] text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950"
                >
                  {roleLabels[role] || role}
                </Badge>
              ))}
              {idea.missingRoles.length > 4 && (
                <Badge variant="outline" className="text-[11px]">
                  +{idea.missingRoles.length - 4}
                </Badge>
              )}
            </div>
          )}

          {idea.resourceRequests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.resourceRequests
                .filter((r) => !r.resolved)
                .slice(0, 3)
                .map((r) => (
                  <Badge
                    key={r.tag}
                    variant="outline"
                    className="text-[11px] text-blue-600 border-blue-300 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950"
                  >
                    <Package className="h-3 w-3 mr-0.5" />
                    {r.resourceName}
                  </Badge>
                ))}
              {idea.resourceRequests.filter((r) => !r.resolved).length > 3 && (
                <Badge variant="outline" className="text-[11px]">
                  +{idea.resourceRequests.filter((r) => !r.resolved).length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t">
            <div className="flex gap-2">
              {REACTION_TYPES.map((type) => {
                const count = idea.reactionCounts[type] || 0;
                if (count === 0) return null;
                const isActive = idea.userReactions.includes(type);
                return (
                  <span
                    key={type}
                    className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}
                  >
                    {REACTION_EMOJI[type]} {count}
                  </span>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              {idea.interestCount > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Heart className="h-3 w-3" />
                  {idea.interestCount}
                </span>
              )}
              {idea.isInterested && !idea.isMember && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 ml-1"
                >
                  Interested
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
