import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  assertIdeasUnlocked,
  canReadLegacyScope,
  claimLegacyIdeaScopeForMutation,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  requireParticipant,
  resolveLegacyScopeForMutation,
  REACTION_TYPES,
} from "./lib";
import { internal } from "./_generated/api";
import { refreshIdeaReactionStats } from "./ideaStats";

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
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .collect();

    const sameType = existing.find((r) => r.type === type);

    for (const reaction of existing) {
      const reactionScope = await resolveLegacyScopeForMutation(
        ctx,
        reaction.hackathonId,
        hackathonId,
        "Reaction",
      );
      if (reactionScope.shouldPatch) {
        await ctx.db.patch(reaction._id, { hackathonId });
      }
    }

    if (sameType) {
      await ctx.db.delete(sameType._id);
      await refreshIdeaReactionStats(ctx, ideaId);
    } else {
      await ctx.db.insert("reactions", {
        hackathonId,
        ideaId,
        userId,
        type,
      });
      await refreshIdeaReactionStats(ctx, ideaId);
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
    const { userId } = await getAuthenticatedUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) return [];
    const hackathon = await getHackathonByIdOrCurrent(ctx, idea.hackathonId);
    if (!hackathon) return [];
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const includeLegacy = await canReadLegacyScope(ctx, hackathon._id);
    return (
      await ctx.db
        .query("reactions")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(
      (reaction) =>
        reaction.hackathonId === hackathon._id ||
        (includeLegacy && reaction.hackathonId === undefined),
    );
  },
});
