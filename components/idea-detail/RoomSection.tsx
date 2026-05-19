"use client";

import Link from "next/link";
import { Link2, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/constants";
import type { IdeaDetail } from "@/lib/types";

export function RoomSection({ idea }: { idea: IdeaDetail }) {
  if (!idea.room) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        <DoorOpen className="h-5 w-5" />
        Room
      </h2>
      <div className="rounded-lg border px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{idea.room.roomName}</span>
          <Badge
            variant={idea.room.roomType === "shared" ? "default" : "secondary"}
            className="text-xs"
          >
            {ROOM_TYPE_LABELS[idea.room.roomType as RoomType] ||
              idea.room.roomType}
          </Badge>
        </div>
        {idea.room.roomType === "shared" &&
          idea.room.sharedWithIdeas.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Shared with:</p>
              <div className="flex flex-wrap gap-1.5">
                {idea.room.sharedWithIdeas.map((shared) => (
                  <Link
                    key={shared._id}
                    href={`/product/ideas/${shared._id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    {shared.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
