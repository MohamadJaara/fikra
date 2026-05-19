"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar, UserLink } from "@/components/UserLink";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  TEAM_SIZE_LABELS,
  type Status,
} from "@/lib/constants";
import type { IdeaDetail } from "@/lib/types";
import { timeAgo } from "./shared";

export function IdeaHeader({ idea }: { idea: IdeaDetail }) {
  return (
    <header className="mb-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-4">
        {idea.title}
      </h1>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {idea.categoryName && (
          <span className="text-sm text-muted-foreground">
            {idea.categoryName}
          </span>
        )}
        {idea.categoryName && <span className="text-muted-foreground/40">·</span>}
        <Badge
          variant="secondary"
          className={`text-[11px] font-medium ${STATUS_COLORS[idea.status as Status] || "bg-muted"}`}
        >
          {STATUS_LABELS[idea.status as Status] || idea.status}
        </Badge>
        {idea.onsiteOnly && (
          <Badge
            variant="outline"
            className="text-[11px] text-blue-700 border-blue-300 bg-blue-50/80 dark:text-blue-300 dark:border-blue-700 dark:bg-blue-950/50"
          >
            <MapPin className="h-3 w-3 mr-1" />
            On-site
          </Badge>
        )}
        <span className="text-muted-foreground/40">·</span>
        <span className="text-[11px] text-muted-foreground">
          {idea.memberCount}/{TEAM_SIZE_LABELS[idea.teamSize]} team
        </span>
      </div>

      <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mb-5">
        {idea.pitch}
      </p>

      <div className="flex items-center gap-2.5 text-sm">
        <UserAvatar
          handle={idea.ownerHandle}
          image={idea.ownerImage}
          name={idea.ownerName}
          size="md"
        />
        <UserLink
          handle={idea.ownerHandle}
          name={idea.ownerName}
          className="font-medium text-foreground"
        />
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground">{timeAgo(idea._creationTime)}</span>
      </div>
    </header>
  );
}
