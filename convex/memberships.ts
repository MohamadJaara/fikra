import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  mergeUniqueStringArrays,
  normalizeOptionalStringArray,
  validateRoleSlugs,
} from "./lib";
import { internal } from "./_generated/api";

export const join = mutation({
  args: {
    ideaId: v.id("ideas"),
    memberRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { ideaId, memberRoles }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const existing = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (existing) throw new Error("Already a member");

    const roles = normalizeOptionalStringArray(memberRoles);
    if (roles) {
      await validateRoleSlugs(ctx, roles);
    }

    await ctx.db.insert("ideaMembers", {
      ideaId,
      userId,
      memberRoles: roles,
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: idea.ownerId,
      actorId: userId,
      ideaId,
      type: "member_joined",
    });
  },
});

export const leave = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId === userId)
      throw new Error("Owner cannot leave their own idea");

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member");

    await ctx.db.delete(membership._id);
  },
});

export const updateMemberRoles = mutation({
  args: {
    ideaId: v.id("ideas"),
    targetUserId: v.id("users"),
    memberRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { ideaId, targetUserId, memberRoles }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId)
      throw new Error("Only the idea owner can update member roles");

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", targetUserId),
      )
      .first();
    if (!membership) throw new Error("Target user is not a member");

    const roles = normalizeOptionalStringArray(memberRoles);
    if (roles) {
      await validateRoleSlugs(ctx, roles);
    }

    await ctx.db.patch(membership._id, {
      memberRoles: roles,
      role: undefined,
    });
  },
});

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const memberships = await ctx.db
      .query("ideaMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const ideas = await Promise.all(
      memberships.map(async (m) => {
        const idea = await ctx.db.get(m.ideaId);
        return idea
          ? {
              ...idea,
              memberRoles: mergeUniqueStringArrays(
                m.memberRoles,
                m.role ? [m.role] : undefined,
              ),
            }
          : null;
      }),
    );

    return ideas.filter((i) => i !== null);
  },
});
