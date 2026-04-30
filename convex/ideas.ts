import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  getAuthenticatedUser,
  getResourceNameMap,
  getUserDisplayName,
  mergeUniqueStringArrays,
  sanitizeText,
  validateStringLength,
  isEmailAllowed,
  STATUSES,
  TEAM_SIZES,
  resolveTeamSize,
  validateResourceSlugs,
  validateRoleSlugs,
} from "./lib";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { IdeaListItem } from "../lib/types";
import {
  getResourceRequestSummary,
  refreshIdeaInterestStats,
  refreshIdeaMemberStats,
  refreshIdeaResourceStats,
} from "./ideaStats";

const TRANSFER_STATUS_PENDING = "pending";
const TRANSFER_STATUS_ACCEPTED = "accepted";
const TRANSFER_STATUS_DECLINED = "declined";
const TRANSFER_STATUS_CANCELED = "canceled";
const IDEA_LIST_SORT_OPTIONS = [
  "newest",
  "oldest",
  "most_reactions",
  "most_interest",
] as const;

const MAX_CANDIDATE_IDEAS = 1000;

type IdeaListSortOption = (typeof IDEA_LIST_SORT_OPTIONS)[number];
type IdeaListFilters = {
  search?: string;
  statuses?: string[];
  roles?: string[];
  resourceTags?: string[];
  categories?: Array<Id<"categories"> | "__none__">;
  needsTeammates?: boolean;
  needsResources?: boolean;
};

async function getIdeaListMembershipMaps(ctx: QueryCtx, userId: Id<"users">) {
  const [memberships, interests, reactions] = await Promise.all([
    ctx.db
      .query("ideaMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("ideaInterest")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("reactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);

  const memberIdeaIds = new Set(memberships.map((m) => m.ideaId));
  const interestedIdeaIds = new Set(interests.map((i) => i.ideaId));
  const reactionsByIdeaId = new Map<Id<"ideas">, string[]>();
  for (const reaction of reactions) {
    const existing = reactionsByIdeaId.get(reaction.ideaId) ?? [];
    existing.push(reaction.type);
    reactionsByIdeaId.set(reaction.ideaId, existing);
  }

  return { memberIdeaIds, interestedIdeaIds, reactionsByIdeaId };
}

async function getIdeaListViewerId(ctx: QueryCtx): Promise<Id<"users"> | null> {
  const authId = await getAuthUserId(ctx);
  if (!authId) return null;

  const user = await ctx.db.get(authId);
  if (!user || !user.email || !isEmailAllowed(user.email)) {
    return null;
  }

  return authId;
}

async function buildIdeaListItems(
  ctx: QueryCtx,
  ideas: Doc<"ideas">[],
  userId: Id<"users">,
) {
  const resourceNameMap = await getResourceNameMap(ctx);
  const { memberIdeaIds, interestedIdeaIds, reactionsByIdeaId } =
    await getIdeaListMembershipMaps(ctx, userId);

  const results = await Promise.all(
    ideas.map(async (idea) => {
      const owner = await ctx.db.get(idea.ownerId);
      const category = idea.categoryId
        ? await ctx.db.get(idea.categoryId)
        : null;

      const [legacyMembers, legacyInterestDocs, legacyReactionDocs] =
        idea.memberCount === undefined ||
        idea.filledRoles === undefined ||
        idea.interestCount === undefined ||
        idea.reactionCounts === undefined
          ? await Promise.all([
              idea.memberCount === undefined || idea.filledRoles === undefined
                ? ctx.db
                    .query("ideaMembers")
                    .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
                    .collect()
                : Promise.resolve(null),
              idea.interestCount === undefined
                ? ctx.db
                    .query("ideaInterest")
                    .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
                    .collect()
                : Promise.resolve(null),
              idea.reactionCounts === undefined
                ? ctx.db
                    .query("reactions")
                    .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
                    .collect()
                : Promise.resolve(null),
            ])
          : [null, null, null];

      const legacyReactionCounts: Record<string, number> = {};
      for (const reaction of legacyReactionDocs ?? []) {
        legacyReactionCounts[reaction.type] =
          (legacyReactionCounts[reaction.type] || 0) + 1;
      }

      const legacyFilledRoles = new Set<string>();
      for (const member of legacyMembers ?? []) {
        for (const role of mergeUniqueStringArrays(
          member.memberRoles,
          member.role ? [member.role] : undefined,
        ) ?? []) {
          legacyFilledRoles.add(role);
        }
      }

      const resourceDocs = await getResourceRequestSummary(ctx, idea);
      const filledRoles = new Set(idea.filledRoles ?? [...legacyFilledRoles]);
      const missingRoles = idea.lookingForRoles.filter(
        (role) => !filledRoles.has(role),
      );

      const isMember = memberIdeaIds.has(idea._id);
      const isInterested = interestedIdeaIds.has(idea._id);
      const isOwner = idea.ownerId === userId;

      let room: IdeaListItem["room"] = null;
      if (idea.roomId) {
        const roomDoc = await ctx.db.get(idea.roomId);
        if (roomDoc) {
          const sharedWithIdeas: { _id: Id<"ideas">; title: string }[] = [];
          if (roomDoc.type === "shared") {
            const otherIdeasInRoom = await ctx.db
              .query("ideas")
              .withIndex("by_room", (q) => q.eq("roomId", roomDoc._id))
              .collect();
            for (const other of otherIdeasInRoom) {
              if (other._id !== idea._id) {
                sharedWithIdeas.push({ _id: other._id, title: other.title });
              }
            }
          }
          room = {
            roomId: roomDoc._id,
            roomName: roomDoc.name,
            roomType: roomDoc.type,
            sharedWithIdeas,
          };
        }
      }

      const { teamSizeWanted: _legacyTeamSize, ...ideaRest } = idea;
      return {
        ...ideaRest,
        teamSize: resolveTeamSize(idea),
        categoryName: category?.name,
        ownerName: getUserDisplayName(owner),
        ownerImage: owner?.image,
        ownerHandle: owner?.handle,
        memberCount: idea.memberCount ?? legacyMembers?.length ?? 0,
        interestCount: idea.interestCount ?? legacyInterestDocs?.length ?? 0,
        reactionCounts: idea.reactionCounts ?? legacyReactionCounts,
        userReactions: reactionsByIdeaId.get(idea._id) ?? [],
        missingRoles,
        hasUnresolvedResources:
          idea.hasUnresolvedResources ?? resourceDocs.some((r) => !r.resolved),
        resourceRequestCount: idea.resourceRequestCount ?? resourceDocs.length,
        resourceRequests: resourceDocs.map((resource) => ({
          ...resource,
          resourceName: resourceNameMap[resource.tag] || resource.tag,
        })),
        isMember,
        isInterested,
        isOwner,
        room,
      };
    }),
  );

  return results;
}

function rawIdeaMatchesFilters(idea: Doc<"ideas">, filters?: IdeaListFilters) {
  if (!filters) return true;

  const search = filters.search?.trim().toLowerCase();
  if (
    search &&
    !idea.title.toLowerCase().includes(search) &&
    !idea.pitch.toLowerCase().includes(search)
  ) {
    return false;
  }

  if (filters.statuses?.length && !filters.statuses.includes(idea.status)) {
    return false;
  }

  if (
    filters.categories?.length &&
    !filters.categories.some((categoryId) =>
      categoryId === "__none__"
        ? !idea.categoryId
        : idea.categoryId === categoryId,
    )
  ) {
    return false;
  }

  if (filters.needsTeammates) {
    if (idea.status === "full") return false;
    const filledRoles = new Set(idea.filledRoles ?? []);
    if (!idea.lookingForRoles.some((role) => !filledRoles.has(role)))
      return false;
  }

  if (filters.needsResources && idea.hasUnresolvedResources === false) {
    return false;
  }

  if (filters.roles?.length) {
    const filledRoles = new Set(idea.filledRoles ?? []);
    const missingRoles = idea.lookingForRoles.filter(
      (role) => !filledRoles.has(role),
    );
    if (!filters.roles.some((role) => missingRoles.includes(role)))
      return false;
  }

  if (filters.resourceTags?.length) {
    const summary = idea.resourceRequestSummary;
    if (!summary) return true;
    if (
      !filters.resourceTags.some((tag) =>
        summary.some((r) => r.tag === tag && !r.resolved),
      )
    )
      return false;
  }

  return true;
}

function hasActiveIdeaListFilters(filters?: IdeaListFilters) {
  if (!filters) return false;
  return Boolean(
    filters.search?.trim() ||
    filters.statuses?.length ||
    filters.roles?.length ||
    filters.resourceTags?.length ||
    filters.categories?.length ||
    filters.needsTeammates ||
    filters.needsResources,
  );
}

function sortRawIdeas(
  ideas: Doc<"ideas">[],
  sortBy: IdeaListSortOption = "newest",
) {
  const sorted = [...ideas];
  switch (sortBy) {
    case "oldest":
      sorted.sort((a, b) => a._creationTime - b._creationTime);
      break;
    case "most_reactions": {
      const reactionTotal = (idea: Doc<"ideas">) => {
        const counts = idea.reactionCounts;
        if (!counts) return 0;
        return Object.values(counts).reduce((sum, n) => sum + n, 0);
      };
      sorted.sort((a, b) => {
        const delta = reactionTotal(b) - reactionTotal(a);
        return delta || b._creationTime - a._creationTime;
      });
      break;
    }
    case "most_interest":
      sorted.sort((a, b) => {
        const delta = (b.interestCount ?? 0) - (a.interestCount ?? 0);
        return delta || b._creationTime - a._creationTime;
      });
      break;
    default:
      sorted.sort((a, b) => b._creationTime - a._creationTime);
  }
  return sorted;
}

function parsePaginationCursor(cursor: string | null) {
  if (!cursor) return 0;
  const offset = Number.parseInt(cursor, 10);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

function candidateLimitForPagination(paginationOpts: {
  numItems: number;
  cursor: string | null;
}) {
  const requestedEnd =
    parsePaginationCursor(paginationOpts.cursor) + paginationOpts.numItems;
  return Math.min(
    MAX_CANDIDATE_IDEAS,
    Math.max(requestedEnd, paginationOpts.numItems),
  );
}

function paginateIdeaListItems<T>(
  items: T[],
  paginationOpts: {
    numItems: number;
    cursor: string | null;
  },
) {
  const start = parsePaginationCursor(paginationOpts.cursor);
  const end = Math.min(start + paginationOpts.numItems, items.length);
  return {
    page: items.slice(start, end),
    isDone: end >= items.length,
    continueCursor: String(end),
  };
}

async function filterSortPaginateEnrich(
  ctx: QueryCtx,
  candidates: Doc<"ideas">[],
  filters: IdeaListFilters | undefined,
  sortBy: IdeaListSortOption,
  paginationOpts: { numItems: number; cursor: string | null },
  userId: Id<"users">,
) {
  const filteredIdeas = candidates.filter((idea) =>
    rawIdeaMatchesFilters(idea, filters),
  );
  const sortedIdeas = sortRawIdeas(filteredIdeas, sortBy);
  const { page, isDone, continueCursor } = paginateIdeaListItems(
    sortedIdeas,
    paginationOpts,
  );
  const enrichedPage = await buildIdeaListItems(ctx, page, userId);
  return { page: enrichedPage, isDone, continueCursor };
}

function assertOnsiteEligibleForIdea(
  idea: { onsiteOnly?: boolean },
  user: { participationMode?: string },
) {
  if (idea.onsiteOnly && user.participationMode !== "onsite") {
    throw new Error(
      "This team is limited to on-site participants only. Update your participation mode to on-site in settings to continue.",
    );
  }
}

export const create = mutation({
  args: {
    title: v.string(),
    pitch: v.string(),
    problem: v.string(),
    targetAudience: v.string(),
    skillsNeeded: v.array(v.string()),
    teamSize: v.union(
      v.literal("solo"),
      v.literal("small"),
      v.literal("medium"),
      v.literal("large"),
    ),
    status: v.string(),
    lookingForRoles: v.array(v.string()),
    resourceTags: v.optional(v.array(v.string())),
    resourceNotes: v.optional(v.string()),
    categoryId: v.id("categories"),
    onsiteOnly: v.optional(v.boolean()),
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

    if (!TEAM_SIZES.includes(args.teamSize)) {
      throw new Error("Invalid team size");
    }

    await validateRoleSlugs(ctx, args.lookingForRoles);

    const ideaId = await ctx.db.insert("ideas", {
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded: args.skillsNeeded.map(sanitizeText),
      teamSize: args.teamSize,
      status: args.status,
      lookingForRoles: args.lookingForRoles,
      ownerId: userId,
      categoryId: args.categoryId,
      onsiteOnly: args.onsiteOnly ?? false,
      memberCount: 1,
      interestCount: 0,
      reactionCounts: {},
      reactionTotal: 0,
      filledRoles: [],
      resourceRequestCount: 0,
      hasUnresolvedResources: false,
      needsTeammates: args.status !== "full" && args.lookingForRoles.length > 0,
      resourceRequestSummary: [],
    });

    await ctx.db.insert("ideaMembers", {
      ideaId,
      userId,
      memberRoles: undefined,
    });

    if (args.resourceTags && args.resourceTags.length > 0) {
      const seenTags = new Set<string>();
      const validatedTags: string[] = [];
      for (const tag of args.resourceTags) {
        if (seenTags.has(tag)) continue;
        seenTags.add(tag);
        validatedTags.push(tag);
      }
      await validateResourceSlugs(ctx, validatedTags);

      const notes = args.resourceNotes
        ? sanitizeText(
            validateStringLength(args.resourceNotes, 0, 1000, "Resource notes"),
          )
        : undefined;

      for (const tag of validatedTags) {
        await ctx.db.insert("resourceRequests", {
          ideaId,
          tag,
          notes,
          resolved: false,
        });
      }
      await refreshIdeaResourceStats(ctx, ideaId);
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
    teamSize: v.union(
      v.literal("solo"),
      v.literal("small"),
      v.literal("medium"),
      v.literal("large"),
    ),
    status: v.string(),
    lookingForRoles: v.array(v.string()),
    categoryId: v.optional(v.id("categories")),
    onsiteOnly: v.optional(v.boolean()),
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

    if (!TEAM_SIZES.includes(args.teamSize)) {
      throw new Error("Invalid team size");
    }

    await validateRoleSlugs(ctx, args.lookingForRoles);

    const currentFilledRoles = new Set(idea.filledRoles ?? []);
    const needsTeammates =
      args.status !== "full" &&
      args.lookingForRoles.some((role) => !currentFilledRoles.has(role));

    await ctx.db.patch(args.ideaId, {
      title,
      pitch,
      problem,
      targetAudience,
      skillsNeeded: args.skillsNeeded.map(sanitizeText),
      teamSize: args.teamSize,
      teamSizeWanted: undefined,
      status: args.status,
      lookingForRoles: args.lookingForRoles,
      categoryId: args.categoryId,
      onsiteOnly: args.onsiteOnly ?? false,
      needsTeammates,
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

    await ctx.runMutation(internal.notifications.deleteForIdea, { ideaId });

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
    assertOnsiteEligibleForIdea(idea, targetUser);

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
    assertOnsiteEligibleForIdea(idea, user);

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
    assertOnsiteEligibleForIdea(idea, newOwner);

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
    await refreshIdeaMemberStats(ctx, request.ideaId);
    if (targetInterest) {
      await refreshIdeaInterestStats(ctx, request.ideaId);
    }
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
  args: {
    paginationOpts: paginationOptsValidator,
    filters: v.optional(
      v.object({
        search: v.optional(v.string()),
        statuses: v.optional(v.array(v.string())),
        roles: v.optional(v.array(v.string())),
        resourceTags: v.optional(v.array(v.string())),
        categories: v.optional(
          v.array(v.union(v.id("categories"), v.literal("__none__"))),
        ),
        needsTeammates: v.optional(v.boolean()),
        needsResources: v.optional(v.boolean()),
      }),
    ),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("oldest"),
        v.literal("most_reactions"),
        v.literal("most_interest"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getIdeaListViewerId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const sortBy = args.sortBy ?? "newest";
    const filters = args.filters;
    const hasFilters = hasActiveIdeaListFilters(filters);
    const isTimeSort = sortBy === "newest" || sortBy === "oldest";

    if (!hasFilters && isTimeSort) {
      const { page, isDone, continueCursor } = await ctx.db
        .query("ideas")
        .order(sortBy === "oldest" ? "asc" : "desc")
        .paginate(args.paginationOpts);
      const enrichedPage = await buildIdeaListItems(ctx, page, userId);
      return { page: enrichedPage, isDone, continueCursor };
    }

    if (!hasFilters && sortBy === "most_interest") {
      const { page, isDone, continueCursor } = await ctx.db
        .query("ideas")
        .withIndex("by_interestCount")
        .order("desc")
        .paginate(args.paginationOpts);
      const enrichedPage = await buildIdeaListItems(ctx, page, userId);
      return { page: enrichedPage, isDone, continueCursor };
    }

    if (!hasFilters && sortBy === "most_reactions") {
      const { page, isDone, continueCursor } = await ctx.db
        .query("ideas")
        .withIndex("by_reactionTotal")
        .order("desc")
        .paginate(args.paginationOpts);
      const enrichedPage = await buildIdeaListItems(ctx, page, userId);
      return { page: enrichedPage, isDone, continueCursor };
    }

    if (filters?.search?.trim()) {
      const searchTerm = filters.search.trim();
      const [titleResults, pitchResults] = await Promise.all([
        ctx.db
          .query("ideas")
          .withSearchIndex("search_title", (q) => q.search("title", searchTerm))
          .take(100),
        ctx.db
          .query("ideas")
          .withSearchIndex("search_pitch", (q) => q.search("pitch", searchTerm))
          .take(100),
      ]);
      const seen = new Set<Id<"ideas">>();
      const candidates: Doc<"ideas">[] = [];
      for (const idea of [...titleResults, ...pitchResults]) {
        if (!seen.has(idea._id)) {
          seen.add(idea._id);
          candidates.push(idea);
        }
      }
      return await filterSortPaginateEnrich(
        ctx,
        candidates,
        { ...filters, search: undefined },
        sortBy,
        args.paginationOpts,
        userId,
      );
    }

    if (filters?.statuses?.length) {
      const statuses = filters.statuses;
      if (
        statuses.length === 1 &&
        isTimeSort &&
        !filters.roles?.length &&
        !filters.resourceTags?.length &&
        !filters.categories?.length &&
        !filters.needsTeammates &&
        !filters.needsResources
      ) {
        const { page, isDone, continueCursor } = await ctx.db
          .query("ideas")
          .withIndex("by_status", (q) => q.eq("status", statuses[0]))
          .order(sortBy === "oldest" ? "asc" : "desc")
          .paginate(args.paginationOpts);
        const enrichedPage = await buildIdeaListItems(ctx, page, userId);
        return { page: enrichedPage, isDone, continueCursor };
      }

      const statusSets = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("ideas")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(candidateLimitForPagination(args.paginationOpts)),
        ),
      );
      return await filterSortPaginateEnrich(
        ctx,
        statusSets.flat(),
        { ...filters, statuses: undefined },
        sortBy,
        args.paginationOpts,
        userId,
      );
    }

    if (filters?.needsTeammates) {
      const candidates = await ctx.db
        .query("ideas")
        .withIndex("by_needsTeammates", (q) => q.eq("needsTeammates", true))
        .take(candidateLimitForPagination(args.paginationOpts));
      return await filterSortPaginateEnrich(
        ctx,
        candidates,
        { ...filters, needsTeammates: undefined },
        sortBy,
        args.paginationOpts,
        userId,
      );
    }

    if (filters?.needsResources) {
      const candidates = await ctx.db
        .query("ideas")
        .withIndex("by_hasUnresolvedResources", (q) =>
          q.eq("hasUnresolvedResources", true),
        )
        .take(candidateLimitForPagination(args.paginationOpts));
      return await filterSortPaginateEnrich(
        ctx,
        candidates,
        { ...filters, needsResources: undefined },
        sortBy,
        args.paginationOpts,
        userId,
      );
    }

    if (filters?.categories?.length) {
      const categoryIds = filters.categories.filter(
        (c): c is Id<"categories"> => c !== "__none__",
      );
      const hasNone = filters.categories.includes("__none__");
      let candidates: Doc<"ideas">[] = [];
      if (categoryIds.length > 0) {
        const sets = await Promise.all(
          categoryIds.map((catId) =>
            ctx.db
              .query("ideas")
              .withIndex("by_category", (q) => q.eq("categoryId", catId))
              .take(candidateLimitForPagination(args.paginationOpts)),
          ),
        );
        candidates = sets.flat();
      }
      if (hasNone) {
        const allIdeas = await ctx.db.query("ideas").take(MAX_CANDIDATE_IDEAS);
        candidates = [...candidates, ...allIdeas.filter((i) => !i.categoryId)];
      }
      return await filterSortPaginateEnrich(
        ctx,
        candidates,
        { ...filters, categories: undefined },
        sortBy,
        args.paginationOpts,
        userId,
      );
    }

    // Bounded fallback for roles-only / resourceTags-only / rare combos
    const candidates = await ctx.db.query("ideas").take(MAX_CANDIDATE_IDEAS);
    return await filterSortPaginateEnrich(
      ctx,
      candidates,
      filters,
      sortBy,
      args.paginationOpts,
      userId,
    );
  },
});

export const listByCategory = query({
  args: {
    categoryId: v.id("categories"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getIdeaListViewerId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const { page, isDone, continueCursor } = await ctx.db
      .query("ideas")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .order("desc")
      .paginate(args.paginationOpts);

    const enrichedPage = await buildIdeaListItems(ctx, page, userId);
    return { page: enrichedPage, isDone, continueCursor };
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
          name: getUserDisplayName(u),
          image: u?.image,
          handle: u?.handle,
          ...(isOwner ? { email: u?.email } : {}),
          roles: u?.roles,
          participationMode: u?.participationMode,
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
          name: getUserDisplayName(u),
          image: u?.image,
          handle: u?.handle,
          roles: u?.roles,
          participationMode: u?.participationMode,
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
    const resourceNameMap = await getResourceNameMap(ctx);

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
              requesterName: getUserDisplayName(requester),
              requesterImage: requester?.image,
              requesterHandle: requester?.handle,
              recipientId: pendingTransferRequest.recipientId,
              recipientName: getUserDisplayName(recipient),
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
    const missingRoles = idea.lookingForRoles.filter(
      (role) => !filledRoles.has(role),
    );

    let room: IdeaListItem["room"] = null;
    if (idea.roomId) {
      const roomDoc = await ctx.db.get(idea.roomId);
      if (roomDoc) {
        const sharedWithIdeas: { _id: Id<"ideas">; title: string }[] = [];
        if (roomDoc.type === "shared") {
          const otherIdeasInRoom = await ctx.db
            .query("ideas")
            .withIndex("by_room", (q) => q.eq("roomId", roomDoc._id))
            .collect();
          for (const other of otherIdeasInRoom) {
            if (other._id !== ideaId) {
              sharedWithIdeas.push({ _id: other._id, title: other.title });
            }
          }
        }
        room = {
          roomId: roomDoc._id,
          roomName: roomDoc.name,
          roomType: roomDoc.type,
          sharedWithIdeas,
        };
      }
    }

    const { teamSizeWanted: _legacyTeamSize, ...ideaRest } = idea;
    return {
      ...ideaRest,
      teamSize: resolveTeamSize(idea),
      categoryName: category?.name,
      ownerName: getUserDisplayName(owner),
      ownerImage: owner?.image,
      ownerHandle: owner?.handle,
      ownerEmail: isOwner ? owner?.email : undefined,
      members: memberDetails,
      memberCount: members.length,
      interestedUsers,
      interestCount: interestDocs.length,
      reactionCounts,
      userReactions,
      resourceRequests: resourceDocs.map((resource) => ({
        ...resource,
        resourceName: resourceNameMap[resource.tag] || resource.tag,
      })),
      hasUnresolvedResources: resourceDocs.some((r) => !r.resolved),
      missingRoles,
      pendingOwnershipTransfer,
      isMember: members.some((m) => m.userId === userId),
      isInterested: interestDocs.some((i) => i.userId === userId),
      isOwner,
      room,
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
