import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./lib";

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

    return await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      actorId: args.actorId,
      ideaId: args.ideaId,
      type: args.type,
      read: false,
      commentId: args.commentId,
    });
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
          actorName: actor?.name || actor?.email || "Someone",
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
    const { userId } = await getAuthenticatedUser(ctx);

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
    const { userId } = await getAuthenticatedUser(ctx);

    const notification = await ctx.db.get(notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.recipientId !== userId)
      throw new Error("Not your notification");

    await ctx.db.patch(notificationId, { read: true });
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
  },
});
