import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser } from "./lib";
import { internal } from "./_generated/api";
import { refreshIdeaInterestStats } from "./ideaStats";

export const express = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const existing = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (existing) throw new Error("Already expressed interest");

    await ctx.db.insert("ideaInterest", { ideaId, userId });
    await refreshIdeaInterestStats(ctx, ideaId);

    await ctx.runMutation(internal.notifications.create, {
      recipientId: idea.ownerId,
      actorId: userId,
      ideaId,
      type: "interest_expressed",
    });
  },
});

export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const interest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (!interest) throw new Error("Not interested");

    await ctx.db.delete(interest._id);
    await refreshIdeaInterestStats(ctx, interest.ideaId);
  },
});

export const getByUser = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const interests = await ctx.db
      .query("ideaInterest")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const ideas = await Promise.all(
      interests.map(async (i) => {
        const idea = await ctx.db.get(i.ideaId);
        return idea;
      }),
    );

    return ideas.filter((i) => i !== null);
  },
});
