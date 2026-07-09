import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  assertIdeasUnlocked,
  claimLegacyIdeaScopeForMutation,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  normalizeOptionalStringArray,
  requireParticipant,
  resolveLegacyScopeForMutation,
  validateRoleSlugs,
} from "./lib";
import { internal } from "./_generated/api";
import { refreshIdeaMemberStats } from "./ideaStats";

export const join = mutation({
  args: {
    ideaId: v.id("ideas"),
    memberRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { ideaId, memberRoles }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    const participant = await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    const existing = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (existing) {
      const membershipScope = await resolveLegacyScopeForMutation(
        ctx,
        existing.hackathonId,
        hackathonId,
        "Membership",
      );
      if (membershipScope.shouldPatch) {
        await ctx.db.patch(existing._id, { hackathonId });
      }
    }
    if (existing && isEffectiveIdeaMember(existing, idea)) {
      throw new Error("Already a member");
    }

    const participationMode =
      participant.participationMode ?? user.participationMode;
    if (idea.onsiteOnly && participationMode !== "onsite") {
      throw new Error(
        "This team is limited to on-site participants only. Update your participation mode to on-site in settings to join.",
      );
    }

    const roles = normalizeOptionalStringArray(memberRoles);
    if (roles) {
      await validateRoleSlugs(ctx, roles, hackathonId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        memberRoles: roles,
        joinedAsOwner: true,
      });
    } else {
      await ctx.db.insert("ideaMembers", {
        hackathonId,
        ideaId,
        userId,
        memberRoles: roles,
        joinedAsOwner: idea.ownerId === userId ? true : undefined,
      });
    }
    await refreshIdeaMemberStats(ctx, ideaId);

    if (idea.ownerId !== userId) {
      await ctx.runMutation(internal.notifications.create, {
        recipientId: idea.ownerId,
        actorId: userId,
        ideaId,
        type: "member_joined",
      });
    }
  },
});

export const leave = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (!membership) throw new Error("Not a member");
    const membershipScope = await resolveLegacyScopeForMutation(
      ctx,
      membership.hackathonId,
      hackathonId,
      "Membership",
    );
    if (membershipScope.shouldPatch) {
      await ctx.db.patch(membership._id, { hackathonId });
    }

    await ctx.db.delete(membership._id);
    await refreshIdeaMemberStats(ctx, ideaId);
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
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", targetUserId),
      )
      .first();
    if (!membership) throw new Error("Target user is not a member");
    const membershipScope = await resolveLegacyScopeForMutation(
      ctx,
      membership.hackathonId,
      hackathonId,
      "Membership",
    );
    if (membershipScope.shouldPatch) {
      await ctx.db.patch(membership._id, { hackathonId });
    }

    const roles = normalizeOptionalStringArray(memberRoles);
    if (roles) {
      await validateRoleSlugs(ctx, roles, hackathonId);
    }

    await ctx.db.patch(membership._id, {
      memberRoles: roles,
      role: undefined,
    });
    await refreshIdeaMemberStats(ctx, ideaId);
  },
});

export const getByUser = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

    const memberships = hackathon
      ? await ctx.db
          .query("ideaMembers")
          .withIndex("by_hackathon_and_user", (q) =>
            q.eq("hackathonId", hackathon._id).eq("userId", userId),
          )
          .collect()
      : await ctx.db
          .query("ideaMembers")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

    const ideas = await Promise.all(
      memberships.map(async (m) => {
        const idea = await ctx.db.get(m.ideaId);
        if (!idea || !isEffectiveIdeaMember(m, idea)) return null;
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
