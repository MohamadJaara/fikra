import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getUserDisplayName } from "./lib";
import type { Id } from "./_generated/dataModel";

async function countUnreadForRecipient(
  ctx: QueryCtx | MutationCtx,
  recipientId: Id<"users">,
) {
  return (
    await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_read", (q) =>
        q.eq("recipientId", recipientId).eq("read", false),
      )
      .collect()
  ).length;
}

export const NOTIFICATION_TYPES = [
  "member_joined",
  "interest_expressed",
  "reaction_added",
  "comment_added",
  "comment_reply",
  "user_mentioned",
  "ownership_transferred",
  "ownership_transfer_requested",
  "ownership_takeover_requested",
  "ownership_transfer_accepted",
  "ownership_takeover_accepted",
  "ownership_transfer_declined",
  "ownership_takeover_declined",
  "ownership_transfer_canceled",
  "ownership_takeover_canceled",
  "ideas_related",
  "merge_requested",
  "merge_accepted",
  "merge_declined",
] as const;

export const create = internalMutation({
  args: {
    recipientId: v.id("users"),
    actorId: v.id("users"),
    ideaId: v.id("ideas"),
    type: v.string(),
    commentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    if (args.recipientId === args.actorId) return null;

    if (
      !NOTIFICATION_TYPES.includes(
        args.type as (typeof NOTIFICATION_TYPES)[number],
      )
    ) {
      throw new Error("Invalid notification type");
    }

    const notificationId = await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      actorId: args.actorId,
      ideaId: args.ideaId,
      type: args.type,
      read: false,
      commentId: args.commentId,
    });

    const recipient = await ctx.db.get(args.recipientId);
    await ctx.db.patch(args.recipientId, {
      unreadNotificationCount:
        typeof recipient?.unreadNotificationCount === "number"
          ? recipient.unreadNotificationCount + 1
          : await countUnreadForRecipient(ctx, args.recipientId),
    });

    return notificationId;
  },
});

export const deleteForIdea = internalMutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const unreadByRecipient = new Map<Id<"users">, number>();
    for (const notification of notifications) {
      if (!notification.read) {
        unreadByRecipient.set(
          notification.recipientId,
          (unreadByRecipient.get(notification.recipientId) ?? 0) + 1,
        );
      }
      await ctx.db.delete(notification._id);
    }

    for (const [recipientId, removedUnread] of unreadByRecipient) {
      const recipient = await ctx.db.get(recipientId);
      if (typeof recipient?.unreadNotificationCount === "number") {
        await ctx.db.patch(recipient._id, {
          unreadNotificationCount: Math.max(
            0,
            recipient.unreadNotificationCount - removedUnread,
          ),
        });
      }
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(50);

    return await Promise.all(
      notifications.map(async (n) => {
        const actor = await ctx.db.get(n.actorId);
        const idea = await ctx.db.get(n.ideaId);
        return {
          ...n,
          actorName: getUserDisplayName(actor, "Someone"),
          actorImage: actor?.image,
          ideaTitle: idea?.title || "Untitled Idea",
        };
      }),
    );
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    if (typeof user.unreadNotificationCount === "number") {
      return user.unreadNotificationCount;
    }

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_read", (q) =>
        q.eq("recipientId", userId).eq("read", false),
      )
      .collect();

    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.recipientId !== userId)
      throw new Error("Not your notification");

    if (!notification.read && typeof user.unreadNotificationCount === "number") {
      await ctx.db.patch(userId, {
        unreadNotificationCount: Math.max(
          0,
          user.unreadNotificationCount - 1,
        ),
      });
    }
    await ctx.db.patch(notificationId, { read: true });
    if (!notification.read && user.unreadNotificationCount === undefined) {
      await ctx.db.patch(userId, {
        unreadNotificationCount: await countUnreadForRecipient(ctx, userId),
      });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_and_read", (q) =>
        q.eq("recipientId", userId).eq("read", false),
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    await ctx.db.patch(userId, { unreadNotificationCount: 0 });
  },
});
