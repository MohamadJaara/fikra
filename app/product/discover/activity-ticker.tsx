"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { UserPlus, Lightbulb } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";

export function ActivityTicker() {
  const items = useQuery(api.discover.getActivityTicker);

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center gap-4 animate-marquee">
        {items.map((item) => (
          <Link
            key={`${item.type}-${item.ideaId}-${item.time}`}
            href={`/product/ideas/${item.ideaId}`}
            className="flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-xs whitespace-nowrap hover:bg-muted transition-colors shrink-0"
          >
            {item.type === "member_joined" ? (
              <UserPlus className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Lightbulb className="h-3 w-3 text-yellow-500 shrink-0" />
            )}
            <Avatar className="h-4 w-4">
              <AvatarImage src={item.userImage} />
              <AvatarFallback className="text-[8px]">
                {item.userName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">
              {item.userName}
              {item.type === "member_joined" ? " joined " : " created "}
            </span>
            <span className="font-medium truncate max-w-[120px]">
              {item.ideaTitle}
            </span>
            <span className="text-muted-foreground">
              {formatTimeAgo(item.time)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
