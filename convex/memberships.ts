import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, validateRoleSlug } from "./lib";
import { internal } from "./_generated/api";

export const join = mutation({
  args: {
    ideaId: v.id("ideas"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { ideaId, role }) => {
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

    if (role) await validateRoleSlug(ctx, role);

    await ctx.db.insert("ideaMembers", {
      ideaId,
      userId,
      role,
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

export const updateRole = mutation({
  args: {
    ideaId: v.id("ideas"),
    targetUserId: v.id("users"),
    role: v.optional(v.string()),
  },
  handler: async (ctx, { ideaId, targetUserId, role }) => {
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

    if (role) await validateRoleSlug(ctx, role);

    await ctx.db.patch(membership._id, { role: role || undefined });
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
        return idea ? { ...idea, memberRole: m.role } : null;
      }),
    );

    return ideas.filter((i) => i !== null);
  },
});
