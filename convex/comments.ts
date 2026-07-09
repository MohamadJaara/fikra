import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  assertHackathonWritable,
  assertIdeaInHackathon,
  assertIdeasUnlocked,
  canReadLegacyScope,
  claimLegacyIdeaScopeForMutation,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  getUserDisplayName,
  requireParticipant,
  resolveLegacyScopeForMutation,
  sanitizeText,
  validateStringLength,
} from "./lib";
import { internal } from "./_generated/api";

async function resolveMentions(
  ctx: QueryCtx,
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
      .withIndex("handle", (q) => q.eq("handle", handle))
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
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    if (parentId) {
      const parent = await ctx.db.get(parentId);
      if (!parent || parent.ideaId !== ideaId) {
        throw new Error("Invalid parent comment");
      }
      const parentScope = await resolveLegacyScopeForMutation(
        ctx,
        parent.hackathonId,
        hackathonId,
        "Parent comment",
      );
      if (parentScope.shouldPatch) {
        await ctx.db.patch(parent._id, { hackathonId });
      }
    }

    const sanitized = sanitizeText(
      validateStringLength(content, 1, 2000, "Comment"),
    );

    const mentionedUserIds = await resolveMentions(ctx, sanitized);

    const commentId = await ctx.db.insert("comments", {
      hackathonId,
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
    const idea = await ctx.db.get(comment.ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    const commentScope = await resolveLegacyScopeForMutation(
      ctx,
      comment.hackathonId,
      hackathonId,
      "Comment",
    );
    if (commentScope.shouldPatch) {
      await ctx.db.patch(comment._id, { hackathonId });
    }
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

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
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    const commentScope = await resolveLegacyScopeForMutation(
      ctx,
      comment.hackathonId,
      hackathonId,
      "Comment",
    );
    if (commentScope.shouldPatch) {
      await ctx.db.patch(comment._id, { hackathonId });
    }
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);
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
      if (reply.ideaId !== comment.ideaId) {
        throw new Error("Comment thread contains a cross-hackathon reply");
      }
      const replyScope = await resolveLegacyScopeForMutation(
        ctx,
        reply.hackathonId,
        hackathonId,
        "Reply",
      );
      if (replyScope.shouldPatch) {
        await ctx.db.patch(reply._id, { hackathonId });
      }
      await ctx.db.delete(reply._id);
    }

    await ctx.db.delete(commentId);
  },
});

export const list = query({
  args: {
    ideaId: v.id("ideas"),
    hackathonId: v.optional(v.id("hackathons")),
  },
  handler: async (ctx, { ideaId, hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) return [];
    const hackathon = await getHackathonByIdOrCurrent(
      ctx,
      hackathonId ?? idea.hackathonId,
    );
    if (!hackathon) return [];
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeaInHackathon(ctx, idea, hackathon._id);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const includeLegacy = await canReadLegacyScope(ctx, hackathon._id);

    const comments = (
      await ctx.db
        .query("comments")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(
      (comment) =>
        comment.hackathonId === hackathon._id ||
        (includeLegacy && comment.hackathonId === undefined),
    );

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
                name: getUserDisplayName(u),
                handle: u.handle,
              });
            }
          }
        }
        return {
          ...c,
          authorName: getUserDisplayName(user),
          authorImage: user?.image,
          authorHandle: user?.handle,
          isAuthor: c.userId === userId,
          mentionedUsers,
        };
      }),
    );

    return withUsers;
  },
});
