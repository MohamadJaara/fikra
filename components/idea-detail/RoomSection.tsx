"use client";

import Link from "next/link";
import {
  Link2,
  Navigation,
  ExternalLink,
  Hourglass,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ROOM_REQUEST_LABELS,
  ROOM_TYPE_LABELS,
  TEAM_FORMATION_SOURCE_LABELS,
  type RoomRequestStatus,
  type RoomType,
  type TeamFormationSource,
} from "@/lib/constants";
import type { IdeaDetail } from "@/lib/types";
import { useProductBase } from "@/components/ProductLayoutClient";

export function RoomSection({ idea }: { idea: IdeaDetail }) {
  const productBase = useProductBase();

  if (!idea.room && idea.teamFormationStatus !== "formed") return null;

  const hasLocationInfo =
    idea.room?.roomAddress ||
    idea.room?.roomDirections ||
    idea.room?.roomMapsLink;

  if (!idea.room) {
    return (
      <div className="mb-8 animate-fade-in">
        <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-3">
          Room
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200">
              <Hourglass className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {ROOM_REQUEST_LABELS[
                    idea.roomRequestStatus as RoomRequestStatus
                  ] || "Needs Room"}
                </p>
                {idea.teamFormationSource && (
                  <Badge variant="outline" className="text-[10px]">
                    {TEAM_FORMATION_SOURCE_LABELS[
                      idea.teamFormationSource as TeamFormationSource
                    ] || idea.teamFormationSource}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                This team is formed and waiting for an admin to assign a room.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-fade-in">
      <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground mb-3">
        Room
      </p>

      <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium">{idea.room.roomName}</span>
          <Badge
            variant={idea.room.roomType === "shared" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {ROOM_TYPE_LABELS[idea.room.roomType as RoomType] ||
              idea.room.roomType}
          </Badge>
        </div>

        {idea.room.roomType === "shared" &&
          idea.room.sharedWithIdeas.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6">
              <Link2 className="h-3 w-3 shrink-0" />
              <span>Shared with</span>
              {idea.room.sharedWithIdeas.map((shared, i) => (
                <span key={shared._id} className="inline-flex items-center">
                  {i > 0 && <span className="mr-1.5">,</span>}
                  <Link
                    href={`${productBase}/ideas/${shared._id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {shared.title}
                  </Link>
                </span>
              ))}
            </div>
          )}

        {hasLocationInfo && (
          <div className="border-t border-border/50 pt-2.5 pl-6 space-y-1.5">
            {idea.room.roomAddress && (
              <p className="text-xs text-muted-foreground">
                {idea.room.roomAddress}
              </p>
            )}
            {idea.room.roomDirections && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Navigation className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/60" />
                <span className="leading-relaxed">
                  {idea.room.roomDirections}
                </span>
              </div>
            )}
            {idea.room.roomMapsLink && (
              <a
                href={idea.room.roomMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-0.5"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Maps
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
