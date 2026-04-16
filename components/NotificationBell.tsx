"use client";

import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/Skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

const TYPE_LABELS: Record<string, string> = {
  member_joined: "joined your idea",
  interest_expressed: "is interested in",
  reaction_added: "reacted to",
  comment_added: "commented on",
  comment_reply: "replied to a comment on",
  user_mentioned: "mentioned you in",
  ownership_transferred: "transferred ownership of",
  ownership_transfer_requested: "requested you take ownership of",
  ownership_takeover_requested: "requested ownership of",
  ownership_transfer_accepted: "accepted ownership of",
  ownership_takeover_accepted: "approved your ownership request for",
  ownership_transfer_declined: "declined ownership of",
  ownership_takeover_declined: "declined your ownership request for",
  ownership_transfer_canceled: "canceled the ownership transfer for",
  ownership_takeover_canceled: "canceled their ownership request for",
  ideas_related: "marked your idea as related to",
  merge_requested: "requested to merge into",
  merge_accepted: "accepted the merge with",
  merge_declined: "declined the merge with",
};

export function NotificationBell() {
  const unreadCount = useQuery(api.notifications.unreadCount);
  const notifications = useQuery(api.notifications.list);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const count = unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">
              {count > 99 ? "99+" : count}
              <span className="absolute inset-0 rounded-full bg-destructive animate-pulse-ring" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {count > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications === undefined ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded" />
                    <Skeleton className="h-3 w-1/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onRead={() => void markRead({ notificationId: n._id })}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2">
          <Link
            href="/product/notifications"
            className="text-xs text-primary hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: {
    _id: Id<"notifications">;
    actorName: string;
    actorImage?: string;
    ideaTitle: string;
    ideaId: Id<"ideas">;
    type: string;
    read: boolean;
    _creationTime: number;
  };
  onRead: () => void;
}) {
  const label = TYPE_LABELS[notification.type] || notification.type;
  const timeAgo = formatTimeAgo(notification._creationTime);

  return (
    <Link
      href={`/product/ideas/${notification.ideaId}`}
      onClick={onRead}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
        !notification.read ? "bg-muted/30" : ""
      }`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={notification.actorImage} />
        <AvatarFallback className="text-xs">
          {notification.actorName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{notification.actorName}</span>{" "}
          <span className="text-muted-foreground">{label}</span>{" "}
          <span className="font-medium truncate">{notification.ideaTitle}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
      </div>
      {!notification.read && (
        <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
      )}
    </Link>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
