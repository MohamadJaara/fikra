import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, REACTION_TYPES } from "./lib";
import { internal } from "./_generated/api";

export const toggle = mutation({
  args: {
    ideaId: v.id("ideas"),
    type: v.string(),
  },
  handler: async (ctx, { ideaId, type }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    if (!REACTION_TYPES.includes(type as (typeof REACTION_TYPES)[number])) {
      throw new Error("Invalid reaction type");
    }

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .collect();

    const sameType = existing.find((r) => r.type === type);

    if (sameType) {
      await ctx.db.delete(sameType._id);
    } else {
      await ctx.db.insert("reactions", { ideaId, userId, type });
      await ctx.runMutation(internal.notifications.create, {
        recipientId: idea.ownerId,
        actorId: userId,
        ideaId,
        type: "reaction_added",
      });
    }
  },
});

export const getByIdea = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
  },
});
