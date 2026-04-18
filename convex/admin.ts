import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAdminUser, getUserDisplayName, resolveTeamSize } from "./lib";
import { STATUSES } from "../lib/constants";

const statusValidator = v.union(...STATUSES.map((s) => v.literal(s)));

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const [users, ideas, comments, reactions, ideaInterest] = await Promise.all(
      [
        ctx.db.query("users").collect(),
        ctx.db.query("ideas").collect(),
        ctx.db.query("comments").collect(),
        ctx.db.query("reactions").collect(),
        ctx.db.query("ideaInterest").collect(),
      ],
    );

    const onboardedUsers = users.filter((u) => u.onboardingComplete).length;

    const ideasByStatus: Record<string, number> = {};
    for (const idea of ideas) {
      ideasByStatus[idea.status] = (ideasByStatus[idea.status] || 0) + 1;
    }

    return {
      totalUsers: users.length,
      onboardedUsers,
      totalIdeas: ideas.length,
      ideasByStatus,
      totalComments: comments.length,
      totalReactions: reactions.length,
      totalInterest: ideaInterest.length,
    };
  },
});

export const updateIdeaStatus = mutation({
  args: {
    ideaId: v.id("ideas"),
    status: statusValidator,
  },
  handler: async (ctx, { ideaId, status }) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    await ctx.db.patch(ideaId, { status });
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const users = await ctx.db.query("users").collect();

    const withCounts = await Promise.all(
      users.map(async (user) => {
        const [ownedIdeas, memberships, interest] = await Promise.all([
          ctx.db
            .query("ideas")
            .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
            .collect(),
          ctx.db
            .query("ideaMembers")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect(),
          ctx.db
            .query("ideaInterest")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect(),
        ]);

        return {
          _id: user._id,
          _creationTime: user._creationTime,
          name: getUserDisplayName(user, ""),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          image: user.image,
          roles: user.roles,
          handle: user.handle,
          isAdmin: user.isAdmin,
          onboardingComplete: user.onboardingComplete,
          ownedIdeasCount: ownedIdeas.length,
          membershipsCount: memberships.length,
          interestCount: interest.length,
        };
      }),
    );

    return withCounts.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listIdeas = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const ideas = await ctx.db.query("ideas").collect();

    const withDetails = await Promise.all(
      ideas.map(async (idea) => {
        const [owner, members, comments, reactions, interest, resources] =
          await Promise.all([
            ctx.db.get(idea.ownerId),
            ctx.db
              .query("ideaMembers")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("comments")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("reactions")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("ideaInterest")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
            ctx.db
              .query("resourceRequests")
              .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
              .collect(),
          ]);

        return {
          _id: idea._id,
          _creationTime: idea._creationTime,
          title: idea.title,
          status: idea.status,
          teamSize: resolveTeamSize(idea),
          lookingForRoles: idea.lookingForRoles,
          ownerId: idea.ownerId,
          ownerName: getUserDisplayName(owner),
          ownerEmail: owner?.email,
          memberCount: members.length,
          commentCount: comments.length,
          reactionCount: reactions.length,
          interestCount: interest.length,
          unresolvedResources: resources.filter((r) => !r.resolved).length,
          roomId: idea.roomId,
          roomName: idea.roomId
            ? ((await ctx.db.get(idea.roomId))?.name ?? null)
            : null,
          onsiteOnly: idea.onsiteOnly ?? false,
        };
      }),
    );

    return withDetails.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const listComments = query({
  args: {},
  handler: async (ctx) => {
    await getAdminUser(ctx);

    const comments = await ctx.db.query("comments").collect();

    const withDetails = await Promise.all(
      comments.map(async (comment) => {
        const [author, idea] = await Promise.all([
          ctx.db.get(comment.userId),
          ctx.db.get(comment.ideaId),
        ]);

        return {
          _id: comment._id,
          _creationTime: comment._creationTime,
          content: comment.content,
          parentId: comment.parentId,
          authorName: getUserDisplayName(author),
          authorEmail: author?.email,
          ideaId: comment.ideaId,
          ideaTitle: idea?.title || "Deleted idea",
        };
      }),
    );

    return withDetails.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const setUserAdmin = mutation({
  args: {
    userId: v.id("users"),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, { userId, isAdmin }) => {
    const { user: admin } = await getAdminUser(ctx);
    if (userId === admin._id) {
      throw new Error("Cannot change your own admin status");
    }
    await ctx.db.patch(userId, { isAdmin });
  },
});

export const deleteIdea = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const members = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const m of members) await ctx.db.delete(m._id);

    const interest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const i of interest) await ctx.db.delete(i._id);

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const c of comments) await ctx.db.delete(c._id);

    const reactions = await ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const r of reactions) await ctx.db.delete(r._id);

    const resources = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const r of resources) await ctx.db.delete(r._id);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const n of notifications) await ctx.db.delete(n._id);

    const transferRequests = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const request of transferRequests) await ctx.db.delete(request._id);

    await ctx.db.delete(ideaId);
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    await getAdminUser(ctx);

    const comment = await ctx.db.get(commentId);
    if (!comment) throw new Error("Comment not found");

    const deleteReplies = async (parentId: Id<"comments">) => {
      const replies = await ctx.db
        .query("comments")
        .withIndex("by_parent", (q) => q.eq("parentId", parentId))
        .collect();
      for (const reply of replies) {
        await deleteReplies(reply._id);
        await ctx.db.delete(reply._id);
      }
    };

    await deleteReplies(commentId);
    await ctx.db.delete(commentId);
  },
});

export const updateIdeaOnsiteOnly = mutation({
  args: {
    ideaId: v.id("ideas"),
    onsiteOnly: v.boolean(),
  },
  handler: async (ctx, { ideaId, onsiteOnly }) => {
    await getAdminUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    await ctx.db.patch(ideaId, { onsiteOnly });
  },
});
