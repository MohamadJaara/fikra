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
import { Users, Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/UserLink";

export function IdeaListRow({ idea }: { idea: IdeaListItem }) {
  const roleLabels = useRolesMap();

  return (
    <Link
      href={`/product/ideas/${idea._id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors duration-150 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-sm truncate">{idea.title}</h3>
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 shrink-0 ${STATUS_COLORS[idea.status as Status] || "bg-muted"}`}
          >
            {STATUS_LABELS[idea.status as Status] || idea.status}
          </Badge>
          {idea.onsiteOnly && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 shrink-0 text-blue-700 border-blue-400 bg-blue-50 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950"
            >
              <MapPin className="h-2.5 w-2.5 mr-0.5" />
              On-site
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{idea.pitch}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {idea.missingRoles.length > 0 && (
          <div className="hidden md:flex items-center gap-1">
            {idea.missingRoles.slice(0, 2).map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950"
              >
                {roleLabels[role] || role}
              </Badge>
            ))}
            {idea.missingRoles.length > 2 && (
              <span className="text-[10px] text-muted-foreground">
                +{idea.missingRoles.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserAvatar
            handle={idea.ownerHandle}
            image={idea.ownerImage}
            name={idea.ownerName}
          />
          <span className="max-w-[80px] truncate">{idea.ownerName}</span>
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {idea.memberCount}
        </span>
        <span className="text-[10px]">{TEAM_SIZE_LABELS[idea.teamSize]}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden lg:flex gap-1.5">
          {REACTION_TYPES.map((type) => {
            const count = idea.reactionCounts[type] || 0;
            if (count === 0) return null;
            return (
              <span key={type} className="text-xs text-muted-foreground">
                {REACTION_EMOJI[type]} {count}
              </span>
            );
          })}
        </div>
        {idea.interestCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" />
            {idea.interestCount}
          </span>
        )}
        {idea.isMember && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Joined
          </Badge>
        )}
      </div>
    </Link>
  );
}
