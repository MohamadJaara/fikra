"use client";

import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationSkeleton } from "@/components/Skeleton";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  member_joined: "joined your idea",
  interest_expressed: "is interested in",
  reaction_added: "reacted to",
  comment_added: "commented on",
  comment_reply: "replied to a comment on",
};

export default function NotificationsPage() {
  const notifications = useQuery(api.notifications.list);
  const unreadCount = useQuery(api.notifications.unreadCount);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {(unreadCount ?? 0) > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Activity on your ideas
      </p>

      {notifications === undefined ? (
        <NotificationSkeleton />
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4 animate-float">🔔</div>
          <p className="text-muted-foreground mb-2">
            No notifications yet. When people interact with your ideas,
            you&apos;ll see it here.
          </p>
          <Link
            href="/product"
            className="text-sm text-primary hover:underline"
          >
            Browse ideas
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((n) => {
            const label = TYPE_LABELS[n.type] || n.type;

            return (
              <Link
                key={n._id}
                href={`/product/ideas/${n.ideaId}`}
                onClick={() => {
                  if (!n.read) void markRead({ notificationId: n._id });
                }}
                className={`flex items-start gap-3 rounded-lg px-4 py-3 transition-colors ${
                  !n.read
                    ? "bg-muted/50 hover:bg-muted/70"
                    : "hover:bg-muted/30"
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={n.actorImage} />
                  <AvatarFallback className="text-xs">
                    {n.actorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{n.actorName}</span>{" "}
                    <span className="text-muted-foreground">{label}</span>{" "}
                    <span className="font-medium">{n.ideaTitle}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatTimeAgo(n._creationTime)}
                  </p>
                </div>
                {!n.read && (
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
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
