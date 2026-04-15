import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  sanitizeText,
  validateStringLength,
  isEmailAllowed,
  STATUSES,
  ROLES,
} from "./lib";
import { internal } from "./_generated/api";

export const create = mutation({
  args: {
    title: v.string(),
    pitch: v.string(),
    problem: v.string(),
    targetAudience: v.string(),
    skillsNeeded: v.array(v.string()),
    teamSizeWanted: v.number(),
    status: v.string(),
    lookingForRoles: v.array(v.string()),
    resourceTags: v.optional(v.array(v.string())),
    resourceNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const title = validateStringLength(args.title, 1, 120, "Title");
    const pitch = validateStringLength(args.pitch, 1, 200, "Pitch");
    const problem = sanitizeText(
      validateStringLength(args.problem, 1, 1000, "Problem"),
    );
    const targetAudience = sanitizeText(
      validateStringLength(args.targetAudience, 1, 500, "Target audience"),
    );

    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new Error("Invalid status");
    }

    for (const role of args.lookingForRoles) {
      if (!ROLES.includes(role as (typeof ROLES)[number])) {
        throw new Error(`Invalid role: ${role}`);
      }
    }

    if (args.teamSizeWanted < 1 || args.teamSizeWanted > 20) {
      throw new Error("Team size must be between 1 and 20");
    }

    const ideaId = await ctx.db.insert("ideas", {
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded: args.skillsNeeded.map(sanitizeText),
      teamSizeWanted: args.teamSizeWanted,
      status: args.status,
      lookingForRoles: args.lookingForRoles,
      ownerId: userId,
    });

    await ctx.db.insert("ideaMembers", {
      ideaId,
      userId,
      role: undefined,
    });

    if (args.resourceTags && args.resourceTags.length > 0) {
      for (const tag of args.resourceTags) {
        await ctx.db.insert("resourceRequests", {
          ideaId,
          tag,
          notes: args.resourceNotes
            ? sanitizeText(args.resourceNotes)
            : undefined,
          resolved: false,
        });
      }
    }

    return ideaId;
  },
});

export const update = mutation({
  args: {
    ideaId: v.id("ideas"),
    title: v.string(),
    pitch: v.string(),
    problem: v.string(),
    targetAudience: v.string(),
    skillsNeeded: v.array(v.string()),
    teamSizeWanted: v.number(),
    status: v.string(),
    lookingForRoles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(args.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) throw new Error("Only the owner can edit");

    const title = validateStringLength(args.title, 1, 120, "Title");
    const pitch = validateStringLength(args.pitch, 1, 200, "Pitch");
    const problem = sanitizeText(
      validateStringLength(args.problem, 1, 1000, "Problem"),
    );
    const targetAudience = sanitizeText(
      validateStringLength(args.targetAudience, 1, 500, "Target audience"),
    );

    if (!STATUSES.includes(args.status as (typeof STATUSES)[number])) {
      throw new Error("Invalid status");
    }

    for (const role of args.lookingForRoles) {
      if (!ROLES.includes(role as (typeof ROLES)[number])) {
        throw new Error(`Invalid role: ${role}`);
      }
    }

    if (args.teamSizeWanted < 1 || args.teamSizeWanted > 20) {
      throw new Error("Team size must be between 1 and 20");
    }

    await ctx.db.patch(args.ideaId, {
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded: args.skillsNeeded.map(sanitizeText),
      teamSizeWanted: args.teamSizeWanted,
      status: args.status,
      lookingForRoles: args.lookingForRoles,
    });
  },
});

export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) throw new Error("Only the owner can delete");

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

    await ctx.db.delete(ideaId);
  },
});

export const transferOwnership = mutation({
  args: {
    ideaId: v.id("ideas"),
    targetUserId: v.id("users"),
    leaveAfterTransfer: v.optional(v.boolean()),
  },
  handler: async (ctx, { ideaId, targetUserId, leaveAfterTransfer }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) {
      throw new Error("Only the owner can transfer ownership");
    }
    if (targetUserId === userId) {
      throw new Error("Choose someone else to own this idea");
    }

    const targetUser = await ctx.db.get(targetUserId);
    if (!targetUser) throw new Error("New owner not found");
    if (!targetUser.onboardingComplete) {
      throw new Error("New owner must complete onboarding first");
    }
    if (!targetUser.email || !isEmailAllowed(targetUser.email)) {
      throw new Error("New owner is not allowed to access this workspace");
    }

    const targetMembership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", targetUserId),
      )
      .first();

    if (!targetMembership) {
      await ctx.db.insert("ideaMembers", {
        ideaId,
        userId: targetUserId,
        role: undefined,
      });
    }

    const targetInterest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", targetUserId),
      )
      .first();
    if (targetInterest) await ctx.db.delete(targetInterest._id);

    if (leaveAfterTransfer) {
      const currentMembership = await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea_and_user", (q) =>
          q.eq("ideaId", ideaId).eq("userId", userId),
        )
        .first();
      if (currentMembership) await ctx.db.delete(currentMembership._id);
    }

    await ctx.db.patch(ideaId, { ownerId: targetUserId });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: targetUserId,
      actorId: userId,
      ideaId,
      type: "ownership_transferred",
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) return [];

    const user = await ctx.db.get(authId);
    if (!user || !user.email || !isEmailAllowed(user.email)) {
      return [];
    }
    const userId = authId;

    const ideas = await ctx.db.query("ideas").collect();

    const results = await Promise.all(
      ideas.map(async (idea) => {
        const owner = await ctx.db.get(idea.ownerId);

        const members = await ctx.db
          .query("ideaMembers")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .collect();

        const interestDocs = await ctx.db
          .query("ideaInterest")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .collect();

        const reactionDocs = await ctx.db
          .query("reactions")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .collect();

        const resourceDocs = await ctx.db
          .query("resourceRequests")
          .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
          .collect();

        const reactionCounts: Record<string, number> = {};
        for (const r of reactionDocs) {
          reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
        }

        const userReactions = reactionDocs
          .filter((r) => r.userId === userId)
          .map((r) => r.type);

        const filledRoles = new Set(
          members.filter((m) => m.role).map((m) => m.role as string),
        );
        const missingRoles = idea.lookingForRoles.filter(
          (role) => !filledRoles.has(role),
        );

        const isMember = members.some((m) => m.userId === userId);
        const isInterested = interestDocs.some((i) => i.userId === userId);
        const isOwner = idea.ownerId === userId;

        return {
          ...idea,
          ownerName: owner?.name || owner?.email || "Unknown",
          ownerImage: owner?.image,
          ownerHandle: owner?.handle,
          memberCount: members.length,
          interestCount: interestDocs.length,
          reactionCounts,
          userReactions,
          missingRoles,
          hasUnresolvedResources: resourceDocs.some((r) => !r.resolved),
          resourceRequestCount: resourceDocs.length,
          resourceRequests: resourceDocs,
          isMember,
          isInterested,
          isOwner,
        };
      }),
    );

    return results.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const get = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) return null;

    const owner = await ctx.db.get(idea.ownerId);

    const members = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const isOwner = idea.ownerId === userId;

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return {
          ...m,
          name: u?.name || u?.email || "Unknown",
          image: u?.image,
          handle: u?.handle,
          ...(isOwner ? { email: u?.email } : {}),
          roles: u?.roles,
        };
      }),
    );

    const interestDocs = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const interestedUsers = await Promise.all(
      interestDocs.map(async (i) => {
        const u = await ctx.db.get(i.userId);
        return {
          ...i,
          name: u?.name || u?.email || "Unknown",
          image: u?.image,
          handle: u?.handle,
          roles: u?.roles,
        };
      }),
    );

    const reactionDocs = await ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const reactionCounts: Record<string, number> = {};
    for (const r of reactionDocs) {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    }

    const userReactions = reactionDocs
      .filter((r) => r.userId === userId)
      .map((r) => r.type);

    const resourceDocs = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const filledRoles = new Set<string>();
    for (const m of members) {
      if (m.role) filledRoles.add(m.role);
    }
    const memberUserRoles = new Map<string, string[]>();
    for (const md of memberDetails) {
      if (md.roles) memberUserRoles.set(md.userId, md.roles);
      for (const r of md.roles ?? []) {
        filledRoles.add(r);
      }
    }
    const missingRoles = idea.lookingForRoles.filter(
      (role) => !filledRoles.has(role),
    );

    return {
      ...idea,
      ownerName: owner?.name || owner?.email || "Unknown",
      ownerImage: owner?.image,
      ownerHandle: owner?.handle,
      ownerEmail: isOwner ? owner?.email : undefined,
      members: memberDetails,
      memberCount: members.length,
      interestedUsers,
      interestCount: interestDocs.length,
      reactionCounts,
      userReactions,
      resourceRequests: resourceDocs,
      hasUnresolvedResources: resourceDocs.some((r) => !r.resolved),
      missingRoles,
      isMember: members.some((m) => m.userId === userId),
      isInterested: interestDocs.some((i) => i.userId === userId),
      isOwner,
    };
  },
});

export const getByOwner = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);
    return await ctx.db
      .query("ideas")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
  },
});
