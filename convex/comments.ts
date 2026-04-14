import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  getAuthenticatedUser,
  sanitizeText,
  validateStringLength,
} from "./lib";
import { internal } from "./_generated/api";

async function resolveMentions(
  ctx: any,
  content: string,
): Promise<Id<"users">[]> {
  const mentionRegex = /@(\w+)/g;
  const matches = [...content.matchAll(mentionRegex)];
  const handles = [...new Set(matches.map((m) => m[1].toLowerCase()))];
  if (handles.length === 0) return [];

  const mentionedIds: Id<"users">[] = [];
  for (const handle of handles) {
    const user = await ctx.db
      .query("users")
      .withIndex("handle", (q: any) => q.eq("handle", handle))
      .first();
    if (user?._id) mentionedIds.push(user._id);
  }
  return mentionedIds;
}

export const create = mutation({
  args: {
    ideaId: v.id("ideas"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, { ideaId, content, parentId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.ideaId !== ideaId) {
        throw new Error("Invalid parent comment");
      }
    }

    const sanitized = sanitizeText(
      validateStringLength(content, 1, 2000, "Comment"),
    );

    const mentionedUserIds = await resolveMentions(ctx, sanitized);

    const commentId = await ctx.db.insert("comments", {
      ideaId,
      userId,
      content: sanitized,
      parentId,
      mentionedUserIds:
        mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
    });

    if (idea.ownerId !== userId) {
      await ctx.runMutation(internal.notifications.create, {
        recipientId: idea.ownerId,
        actorId: userId,
        ideaId,
        type: parentId ? "comment_reply" : "comment_added",
        commentId: parentId ?? commentId,
      });
    }

    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (
        parent &&
        parent.userId !== userId &&
        parent.userId !== idea.ownerId
      ) {
        await ctx.runMutation(internal.notifications.create, {
          recipientId: parent.userId,
          actorId: userId,
          ideaId,
          type: "comment_reply",
          commentId,
        });
      }
    }

    for (const mentionedId of mentionedUserIds) {
      if (mentionedId !== userId && mentionedId !== idea.ownerId) {
        await ctx.runMutation(internal.notifications.create, {
          recipientId: mentionedId,
          actorId: userId,
          ideaId,
          type: "user_mentioned",
          commentId,
        });
      }
    }
  },
});

export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, { commentId, content }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId !== userId)
      throw new Error("Can only edit your own comments");

    const sanitized = sanitizeText(
      validateStringLength(content, 1, 2000, "Comment"),
    );

    const mentionedUserIds = await resolveMentions(ctx, sanitized);

    await ctx.db.patch(commentId, {
      content: sanitized,
      mentionedUserIds:
        mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
    });
  },
});

export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");

    const idea = await ctx.db.get(comment.ideaId);
    const isOwner = idea?.ownerId === userId;
    const isAuthor = comment.userId === userId;

    if (!isOwner && !isAuthor)
      throw new Error(
        "Can only delete your own comments or comments on your ideas",
      );

    const replies = await ctx.db
      .query("comments")
      .withIndex("by_parent", (q) => q.eq("parentId", commentId))
      .collect();

    for (const reply of replies) {
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(commentId);
  },
});

export const list = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const withUsers = await Promise.all(
      comments.map(async (c) => {
        const user = await ctx.db.get(c.userId);
        const mentionedUsers: {
          _id: Id<"users">;
          name: string;
          handle?: string;
        }[] = [];
        if (c.mentionedUserIds) {
          for (const id of c.mentionedUserIds) {
            const u = await ctx.db.get(id);
            if (u) {
              mentionedUsers.push({
                _id: u._id,
                name: u.name || u.email || "Unknown",
                handle: u.handle,
              });
            }
          }
        }
        return {
          ...c,
          authorName: user?.name || user?.email || "Unknown",
          authorImage: user?.image,
          isAuthor: c.userId === userId,
          mentionedUsers,
        };
      }),
    );

    return withUsers;
  },
});
