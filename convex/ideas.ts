import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  mergeUniqueStringArrays,
  sanitizeText,
  validateStringLength,
  isEmailAllowed,
  STATUSES,
  validateRoleSlugs,
} from "./lib";
import { internal } from "./_generated/api";

const TRANSFER_STATUS_PENDING = "pending";
const TRANSFER_STATUS_ACCEPTED = "accepted";
const TRANSFER_STATUS_DECLINED = "declined";
const TRANSFER_STATUS_CANCELED = "canceled";

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
    categoryId: v.id("categories"),
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

    if (args.teamSizeWanted < 1 || args.teamSizeWanted > 20) {
      throw new Error("Team size must be between 1 and 20");
    }

    await validateRoleSlugs(ctx, args.lookingForRoles);

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
      categoryId: args.categoryId,
    });

    await ctx.db.insert("ideaMembers", {
      ideaId,
      userId,
      memberRoles: undefined,
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
    categoryId: v.optional(v.id("categories")),
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

    if (args.teamSizeWanted < 1 || args.teamSizeWanted > 20) {
      throw new Error("Team size must be between 1 and 20");
    }

    await validateRoleSlugs(ctx, args.lookingForRoles);

    await ctx.db.patch(args.ideaId, {
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded: args.skillsNeeded.map(sanitizeText),
      teamSizeWanted: args.teamSizeWanted,
      status: args.status,
      lookingForRoles: args.lookingForRoles,
      categoryId: args.categoryId,
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

    const transferRequests = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();
    for (const request of transferRequests) await ctx.db.delete(request._id);

    const relAsA = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q) => q.eq("ideaIdA", ideaId))
      .collect();
    const relAsB = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q) => q.eq("ideaIdB", ideaId))
      .collect();
    for (const r of [...relAsA, ...relAsB]) await ctx.db.delete(r._id);

    await ctx.db.delete(ideaId);
  },
});

export const requestOwnershipTransfer = mutation({
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

    const existingPendingRequest = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .first();
    if (existingPendingRequest) {
      throw new Error("This idea already has a pending ownership request");
    }

    const requestId = await ctx.db.insert("ownershipTransferRequests", {
      ideaId,
      requesterId: userId,
      recipientId: targetUserId,
      leaveAfterTransfer: leaveAfterTransfer ?? false,
      status: TRANSFER_STATUS_PENDING,
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: targetUserId,
      actorId: userId,
      ideaId,
      type: "ownership_transfer_requested",
    });

    return requestId;
  },
});

export const requestOwnership = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);
    if (!user.onboardingComplete) {
      throw new Error(
        "You must complete onboarding before requesting ownership",
      );
    }

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId === userId) {
      throw new Error("You already own this idea");
    }

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (!membership) {
      throw new Error("Only team members can request ownership");
    }

    const existingPendingRequest = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .first();
    if (existingPendingRequest) {
      throw new Error("This idea already has a pending ownership request");
    }

    const requestId = await ctx.db.insert("ownershipTransferRequests", {
      ideaId,
      requesterId: userId,
      recipientId: idea.ownerId,
      leaveAfterTransfer: false,
      status: TRANSFER_STATUS_PENDING,
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: idea.ownerId,
      actorId: userId,
      ideaId,
      type: "ownership_takeover_requested",
    });

    return requestId;
  },
});

export const acceptOwnershipTransfer = mutation({
  args: {
    requestId: v.id("ownershipTransferRequests"),
    leaveAfterTransfer: v.optional(v.boolean()),
  },
  handler: async (ctx, { requestId, leaveAfterTransfer }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Ownership transfer request not found");
    if (request.status !== TRANSFER_STATUS_PENDING) {
      throw new Error("This ownership transfer request is no longer pending");
    }
    if (request.recipientId !== userId) {
      throw new Error("Only the requested approver can accept this transfer");
    }

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");

    const ownerInitiated = request.requesterId === idea.ownerId;
    const requesterInitiated = request.recipientId === idea.ownerId;
    if (!ownerInitiated && !requesterInitiated) {
      throw new Error("This ownership transfer request is no longer valid");
    }

    const newOwnerId = ownerInitiated
      ? request.recipientId
      : request.requesterId;
    const previousOwnerId = idea.ownerId;
    const newOwner = await ctx.db.get(newOwnerId);
    if (!newOwner) throw new Error("New owner not found");
    if (!newOwner.onboardingComplete) {
      throw new Error("New owner must complete onboarding first");
    }
    if (!newOwner.email || !isEmailAllowed(newOwner.email)) {
      throw new Error("New owner is not allowed to access this workspace");
    }

    const newOwnerMembership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", request.ideaId).eq("userId", newOwnerId),
      )
      .first();

    if (requesterInitiated && !newOwnerMembership) {
      throw new Error("Requester must still be a team member");
    }

    if (!newOwnerMembership) {
      await ctx.db.insert("ideaMembers", {
        ideaId: request.ideaId,
        userId: newOwnerId,
        memberRoles: undefined,
      });
    }

    const targetInterest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", request.ideaId).eq("userId", newOwnerId),
      )
      .first();
    if (targetInterest) await ctx.db.delete(targetInterest._id);

    const shouldRemovePreviousOwner = ownerInitiated
      ? request.leaveAfterTransfer
      : leaveAfterTransfer === true;

    if (shouldRemovePreviousOwner) {
      const currentOwnerMembership = await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea_and_user", (q) =>
          q.eq("ideaId", request.ideaId).eq("userId", previousOwnerId),
        )
        .first();
      if (currentOwnerMembership)
        await ctx.db.delete(currentOwnerMembership._id);
    }

    await ctx.db.patch(request.ideaId, { ownerId: newOwnerId });
    await ctx.db.patch(requestId, {
      status: TRANSFER_STATUS_ACCEPTED,
      respondedAt: Date.now(),
      leaveAfterTransfer: shouldRemovePreviousOwner,
    });

    const otherPendingRequests = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", request.ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .collect();
    for (const otherRequest of otherPendingRequests) {
      if (otherRequest._id !== requestId) {
        await ctx.db.patch(otherRequest._id, {
          status: TRANSFER_STATUS_CANCELED,
          respondedAt: Date.now(),
        });
      }
    }

    await ctx.runMutation(internal.notifications.create, {
      recipientId: request.requesterId,
      actorId: userId,
      ideaId: request.ideaId,
      type: ownerInitiated
        ? "ownership_transfer_accepted"
        : "ownership_takeover_accepted",
    });
  },
});

export const declineOwnershipTransfer = mutation({
  args: { requestId: v.id("ownershipTransferRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Ownership transfer request not found");
    if (request.status !== TRANSFER_STATUS_PENDING) {
      throw new Error("This ownership transfer request is no longer pending");
    }
    if (request.recipientId !== userId) {
      throw new Error("Only the requested approver can decline this transfer");
    }
    const idea = await ctx.db.get(request.ideaId);
    const ownerInitiated = idea?.ownerId === request.requesterId;

    await ctx.db.patch(requestId, {
      status: TRANSFER_STATUS_DECLINED,
      respondedAt: Date.now(),
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: request.requesterId,
      actorId: userId,
      ideaId: request.ideaId,
      type: ownerInitiated
        ? "ownership_transfer_declined"
        : "ownership_takeover_declined",
    });
  },
});

export const cancelOwnershipTransfer = mutation({
  args: { requestId: v.id("ownershipTransferRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Ownership transfer request not found");
    if (request.status !== TRANSFER_STATUS_PENDING) {
      throw new Error("This ownership transfer request is no longer pending");
    }

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (request.requesterId !== userId) {
      throw new Error("Only the requester can cancel this transfer request");
    }
    const ownerInitiated = request.requesterId === idea.ownerId;

    await ctx.db.patch(requestId, {
      status: TRANSFER_STATUS_CANCELED,
      respondedAt: Date.now(),
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: request.recipientId,
      actorId: userId,
      ideaId: request.ideaId,
      type: ownerInitiated
        ? "ownership_transfer_canceled"
        : "ownership_takeover_canceled",
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
        const category = idea.categoryId
          ? await ctx.db.get(idea.categoryId)
          : null;

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
          members.flatMap((m) =>
            mergeUniqueStringArrays(
              m.memberRoles,
              m.role ? [m.role] : undefined,
            ) ?? [],
          ),
        );
        const missingRoles = idea.lookingForRoles.filter(
          (role) => !filledRoles.has(role),
        );

        const isMember = members.some((m) => m.userId === userId);
        const isInterested = interestDocs.some((i) => i.userId === userId);
        const isOwner = idea.ownerId === userId;

        return {
          ...idea,
          categoryName: category?.name,
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
    const category = idea.categoryId ? await ctx.db.get(idea.categoryId) : null;

    const members = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    const isOwner = idea.ownerId === userId;

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        const { role, ...membership } = m;
        return {
          ...membership,
          memberRoles: mergeUniqueStringArrays(
            m.memberRoles,
            role ? [role] : undefined,
          ),
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

    const pendingTransferRequest = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .first();

    const pendingOwnershipTransfer =
      pendingTransferRequest &&
      (pendingTransferRequest.requesterId === idea.ownerId ||
        pendingTransferRequest.recipientId === idea.ownerId) &&
      (isOwner ||
        pendingTransferRequest.requesterId === userId ||
        pendingTransferRequest.recipientId === userId)
        ? await (async () => {
            const [requester, recipient] = await Promise.all([
              ctx.db.get(pendingTransferRequest.requesterId),
              ctx.db.get(pendingTransferRequest.recipientId),
            ]);

            return {
              _id: pendingTransferRequest._id,
              _creationTime: pendingTransferRequest._creationTime,
              ideaId: pendingTransferRequest.ideaId,
              requesterId: pendingTransferRequest.requesterId,
              requesterName: requester?.name || requester?.email || "Unknown",
              requesterImage: requester?.image,
              requesterHandle: requester?.handle,
              recipientId: pendingTransferRequest.recipientId,
              recipientName: recipient?.name || recipient?.email || "Unknown",
              recipientImage: recipient?.image,
              recipientHandle: recipient?.handle,
              leaveAfterTransfer: pendingTransferRequest.leaveAfterTransfer,
              isOwnerInitiated:
                pendingTransferRequest.requesterId === idea.ownerId,
              isRequester: pendingTransferRequest.requesterId === userId,
              isRecipient: pendingTransferRequest.recipientId === userId,
            };
          })()
        : null;

    const filledRoles = new Set<string>();
    for (const member of memberDetails) {
      for (const r of member.memberRoles ?? []) {
        filledRoles.add(r);
      }
    }
    for (const md of memberDetails) {
      for (const r of md.roles ?? []) {
        filledRoles.add(r);
      }
    }
    const missingRoles = idea.lookingForRoles.filter(
      (role) => !filledRoles.has(role),
    );

    return {
      ...idea,
      categoryName: category?.name,
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
      pendingOwnershipTransfer,
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
