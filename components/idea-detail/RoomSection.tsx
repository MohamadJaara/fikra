"use client";

import Link from "next/link";
import { Link2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/constants";
import type { IdeaDetail } from "@/lib/types";

export function RoomSection({ idea }: { idea: IdeaDetail }) {
  if (!idea.room) return null;

  return (
    <div className="mb-8 flex items-start gap-2.5 text-sm text-muted-foreground">
      <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <span className="text-foreground font-medium">
          {idea.room.roomName}
        </span>
        <Badge
          variant={idea.room.roomType === "shared" ? "default" : "secondary"}
          className="text-[10px] ml-1.5"
        >
          {ROOM_TYPE_LABELS[idea.room.roomType as RoomType] ||
            idea.room.roomType}
        </Badge>
        {idea.room.roomType === "shared" &&
          idea.room.sharedWithIdeas.length > 0 && (
            <span className="ml-2">
              shared with{" "}
              {idea.room.sharedWithIdeas.map((shared, i) => (
                <span key={shared._id}>
                  {i > 0 && ", "}
                  <Link
                    href={`/product/ideas/${shared._id}`}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" />
                    {shared.title}
                  </Link>
                </span>
              ))}
            </span>
          )}
      </div>
    </div>
  );
}
