import { getAuthUserId } from "@convex-dev/auth/server";
import {
  query,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  getAuthenticatedUser,
  getResourceNameMap,
  getUserDisplayName,
  assertIdeasUnlocked,
  assertHackathonWritable,
  assertIdeaInHackathon,
  canReadLegacyScope,
  claimLegacyIdeaScopeForMutation,
  getHackathonByIdOrCurrent,
  getParticipant,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  sanitizeText,
  validateStringLength,
  isEmailAllowed,
  STATUSES,
  TEAM_SIZES,
  resolveTeamSize,
  requireParticipant,
  resolveLegacyScopeForMutation,
  validateResourceSlugs,
  validateRoleSlugs,
} from "./lib";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { IdeaListItem, IdeaNavigationItem } from "../lib/types";
import {
  getResourceRequestSummary,
  refreshIdeaInterestStats,
  refreshIdeaMemberStats,
  refreshIdeaResourceStats,
} from "./ideaStats";
import { assertIdeaSubmissionsOpenForHackathon } from "./ideaSubmissions";
import { deleteIdeaAndReferences } from "./ideaLifecycle";

const TRANSFER_STATUS_PENDING = "pending";
const TRANSFER_STATUS_ACCEPTED = "accepted";
const TRANSFER_STATUS_DECLINED = "declined";
const TRANSFER_STATUS_CANCELED = "canceled";
const IDEA_STATUS_SHELVED = "shelved";
const IDEA_STATUS_EXPLORING = "exploring";
const _IDEA_LIST_SORT_OPTIONS = [
  "newest",
  "oldest",
  "most_reactions",
  "most_interest",
] as const;

const MAX_CANDIDATE_IDEAS = 1000;
// A user should have at most one row per relation (or one per reaction type).
// Keep the hot-path point reads bounded even if legacy data contains duplicates.
const MAX_USER_IDEA_RELATION_ROWS_PER_SCOPE = 32;
const IDEA_SCAN_CHUNK_SIZE = 64;
const MAX_IDEA_SCAN_ROWS_PER_PAGE = 256;

type IdeaListSortOption = (typeof _IDEA_LIST_SORT_OPTIONS)[number];
type IdeaListFilters = {
  search?: string;
  shelf?: "active" | "shelved";
  statuses?: string[];
  roles?: string[];
  resourceTags?: string[];
  categories?: Array<Id<"categories"> | "__none__">;
  needsTeammates?: boolean;
  needsResources?: boolean;
};

async function assertIdeaMutationAllowed(
  ctx: MutationCtx,
  idea: Pick<Doc<"ideas">, "_id" | "hackathonId">,
  userId: Id<"users">,
) {
  const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
  await requireParticipant(ctx, hackathonId, userId);
  await assertHackathonWritable(ctx, hackathonId);
  await assertIdeasUnlocked(ctx, hackathonId);
  return hackathonId;
}

async function shouldPatchLegacyChildScope(
  ctx: MutationCtx,
  existingHackathonId: Id<"hackathons"> | undefined,
  hackathonId: Id<"hackathons">,
  entityName: string,
) {
  return (
    await resolveLegacyScopeForMutation(
      ctx,
      existingHackathonId,
      hackathonId,
      entityName,
    )
  ).shouldPatch;
}

async function getIdeaListMembershipMaps(
  ctx: QueryCtx,
  userId: Id<"users">,
  ideas: Doc<"ideas">[],
  hackathonId: Id<"hackathons">,
) {
  const includeLegacy = await canReadLegacyScope(ctx, hackathonId);
  const relationRows = await Promise.all(
    ideas.map(async (idea) => {
      const scopes: Array<Id<"hackathons"> | undefined> = includeLegacy
        ? [hackathonId, undefined]
        : [hackathonId];
      const [membershipSets, interestSets, reactionSets, bookmarkSets] =
        await Promise.all([
          Promise.all(
            scopes.map((scope) =>
              ctx.db
                .query("ideaMembers")
                .withIndex("by_hackathon_and_idea_and_user", (q) =>
                  q
                    .eq("hackathonId", scope)
                    .eq("ideaId", idea._id)
                    .eq("userId", userId),
                )
                .take(MAX_USER_IDEA_RELATION_ROWS_PER_SCOPE),
            ),
          ),
          Promise.all(
            scopes.map((scope) =>
              ctx.db
                .query("ideaInterest")
                .withIndex("by_hackathon_and_idea_and_user", (q) =>
                  q
                    .eq("hackathonId", scope)
                    .eq("ideaId", idea._id)
                    .eq("userId", userId),
                )
                .take(MAX_USER_IDEA_RELATION_ROWS_PER_SCOPE),
            ),
          ),
          Promise.all(
            scopes.map((scope) =>
              ctx.db
                .query("reactions")
                .withIndex("by_hackathon_and_idea_and_user", (q) =>
                  q
                    .eq("hackathonId", scope)
                    .eq("ideaId", idea._id)
                    .eq("userId", userId),
                )
                .take(MAX_USER_IDEA_RELATION_ROWS_PER_SCOPE),
            ),
          ),
          Promise.all(
            scopes.map((scope) =>
              ctx.db
                .query("ideaBookmarks")
                .withIndex("by_hackathon_and_idea_and_user", (q) =>
                  q
                    .eq("hackathonId", scope)
                    .eq("ideaId", idea._id)
                    .eq("userId", userId),
                )
                .take(MAX_USER_IDEA_RELATION_ROWS_PER_SCOPE),
            ),
          ),
        ]);

      return {
        idea,
        memberships: membershipSets.flat(),
        interests: interestSets.flat(),
        reactions: reactionSets.flat(),
        bookmarks: bookmarkSets.flat(),
      };
    }),
  );

  const memberIdeaIds = new Set<Id<"ideas">>();
  const interestedIdeaIds = new Set<Id<"ideas">>();
  const bookmarkedIdeaIds = new Set<Id<"ideas">>();
  const reactionsByIdeaId = new Map<Id<"ideas">, string[]>();
  for (const rows of relationRows) {
    if (
      rows.memberships.some((membership) =>
        isEffectiveIdeaMember(membership, rows.idea),
      )
    ) {
      memberIdeaIds.add(rows.idea._id);
    }
    if (rows.interests.length > 0) interestedIdeaIds.add(rows.idea._id);
    if (rows.bookmarks.length > 0) bookmarkedIdeaIds.add(rows.idea._id);
    reactionsByIdeaId.set(rows.idea._id, [
      ...new Set(rows.reactions.map((reaction) => reaction.type)),
    ]);
  }

  return {
    memberIdeaIds,
    interestedIdeaIds,
    bookmarkedIdeaIds,
    reactionsByIdeaId,
  };
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
  hackathonId: Id<"hackathons">,
) {
  const resourceNameMap = await getResourceNameMap(ctx, hackathonId);
  const {
    memberIdeaIds,
    interestedIdeaIds,
    bookmarkedIdeaIds,
    reactionsByIdeaId,
  } = await getIdeaListMembershipMaps(ctx, userId, ideas, hackathonId);

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

      const effectiveLegacyMembers = (legacyMembers ?? []).filter((member) =>
        isEffectiveIdeaMember(member, idea),
      );

      const legacyFilledRoles = new Set<string>();
      for (const member of effectiveLegacyMembers) {
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
      const isBookmarked = bookmarkedIdeaIds.has(idea._id);
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
            roomAddress: roomDoc.address,
            roomDirections: roomDoc.directions,
            roomMapsLink: roomDoc.mapsLink,
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
        teamFormationStatus: idea.teamFormationStatus ?? "forming",
        teamFormationSource: idea.teamFormationSource,
        teamFormedAt: idea.teamFormedAt,
        roomRequestStatus: idea.roomId
          ? "assigned"
          : (idea.roomRequestStatus ?? "none"),
        roomRequestedAt: idea.roomRequestedAt,
        memberCount: idea.memberCount ?? effectiveLegacyMembers.length,
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
        isBookmarked,
        isOwner,
        room,
      };
    }),
  );

  return results;
}

async function buildIdeaNavigationItem(
  ctx: QueryCtx,
  idea: Doc<"ideas"> | null,
): Promise<IdeaNavigationItem | null> {
  if (!idea) return null;

  const category = idea.categoryId ? await ctx.db.get(idea.categoryId) : null;
  return {
    _id: idea._id,
    title: idea.title,
    pitch: idea.pitch,
    status: idea.status,
    categoryName: category?.name,
  };
}

function rawIdeaMatchesFilters(idea: Doc<"ideas">, filters?: IdeaListFilters) {
  if (!filters) return true;

  if (filters.shelf === "active" && idea.status === IDEA_STATUS_SHELVED) {
    return false;
  }

  if (filters.shelf === "shelved" && idea.status !== IDEA_STATUS_SHELVED) {
    return false;
  }

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
    if (idea.status === "full" || idea.status === IDEA_STATUS_SHELVED) {
      return false;
    }
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

function normalizeIdeaListFilters(filters?: IdeaListFilters): IdeaListFilters {
  return {
    ...filters,
    shelf: filters?.shelf ?? "active",
  };
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

type IdeaScanSourceState = {
  cursor: string | null;
  exhausted: boolean;
  bufferedIds: Id<"ideas">[];
};

type IdeaScanCursor = {
  version: 1;
  scoped: IdeaScanSourceState;
  legacy?: IdeaScanSourceState;
};

type MutableIdeaScanSource = {
  scope: Id<"hackathons"> | undefined;
  cursor: string | null;
  exhausted: boolean;
  buffer: Doc<"ideas">[];
};

function emptyIdeaScanSourceState(): IdeaScanSourceState {
  return { cursor: null, exhausted: false, bufferedIds: [] };
}

function parseIdeaScanSourceState(value: unknown): IdeaScanSourceState | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (source.cursor !== null && typeof source.cursor !== "string") {
    return null;
  }
  if (!Array.isArray(source.bufferedIds)) return null;
  if (!source.bufferedIds.every((id) => typeof id === "string")) return null;
  if (typeof source.exhausted !== "boolean") return null;
  return {
    cursor: source.cursor as string | null,
    exhausted: source.exhausted,
    bufferedIds: source.bufferedIds.slice(
      0,
      IDEA_SCAN_CHUNK_SIZE,
    ) as Id<"ideas">[],
  };
}

function parseIdeaScanCursor(
  cursor: string | null,
  includeLegacy: boolean,
): IdeaScanCursor {
  const fallback: IdeaScanCursor = {
    version: 1,
    scoped: emptyIdeaScanSourceState(),
    ...(includeLegacy ? { legacy: emptyIdeaScanSourceState() } : {}),
  };
  if (!cursor) return fallback;

  try {
    const parsed = JSON.parse(cursor) as Record<string, unknown>;
    if (parsed.version !== 1) return fallback;
    const scoped = parseIdeaScanSourceState(parsed.scoped);
    const legacy = includeLegacy
      ? parseIdeaScanSourceState(parsed.legacy)
      : undefined;
    if (!scoped || (includeLegacy && !legacy)) return fallback;
    return { version: 1, scoped, ...(legacy ? { legacy } : {}) };
  } catch {
    // Cursors from the former offset implementation safely restart at page one.
    return fallback;
  }
}

async function loadIdeaScanBuffer(
  ctx: QueryCtx,
  ids: Id<"ideas">[],
  scope: Id<"hackathons"> | undefined,
  filters?: IdeaListFilters,
  categoryId?: Id<"categories">,
) {
  const documents = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return documents.filter(
    (idea): idea is Doc<"ideas"> =>
      idea !== null &&
      idea.hackathonId === scope &&
      (categoryId === undefined || idea.categoryId === categoryId) &&
      rawIdeaMatchesFilters(idea, filters),
  );
}

function compareIdeasForSort(
  left: Doc<"ideas">,
  right: Doc<"ideas">,
  sortBy: IdeaListSortOption,
) {
  switch (sortBy) {
    case "oldest":
      return left._creationTime - right._creationTime;
    case "most_reactions": {
      const leftTotal = left.reactionTotal ?? 0;
      const rightTotal = right.reactionTotal ?? 0;
      return rightTotal - leftTotal || right._creationTime - left._creationTime;
    }
    case "most_interest":
      return (
        (right.interestCount ?? 0) - (left.interestCount ?? 0) ||
        right._creationTime - left._creationTime
      );
    default:
      return right._creationTime - left._creationTime;
  }
}

async function paginateIdeaScanSource(
  ctx: QueryCtx,
  source: MutableIdeaScanSource,
  sortBy: IdeaListSortOption,
  numItems: number,
  categoryId?: Id<"categories">,
) {
  if (categoryId !== undefined) {
    return await ctx.db
      .query("ideas")
      .withIndex("by_hackathon_and_category", (q) =>
        q.eq("hackathonId", source.scope).eq("categoryId", categoryId),
      )
      .order(sortBy === "oldest" ? "asc" : "desc")
      .paginate({ cursor: source.cursor, numItems });
  }

  if (sortBy === "most_interest") {
    return await ctx.db
      .query("ideas")
      .withIndex("by_hackathon_and_interestCount", (q) =>
        q.eq("hackathonId", source.scope),
      )
      .order("desc")
      .paginate({ cursor: source.cursor, numItems });
  }

  if (sortBy === "most_reactions") {
    return await ctx.db
      .query("ideas")
      .withIndex("by_hackathon_and_reactionTotal", (q) =>
        q.eq("hackathonId", source.scope),
      )
      .order("desc")
      .paginate({ cursor: source.cursor, numItems });
  }

  return await ctx.db
    .query("ideas")
    .withIndex("by_hackathon", (q) => q.eq("hackathonId", source.scope))
    .order(sortBy === "oldest" ? "asc" : "desc")
    .paginate({ cursor: source.cursor, numItems });
}

async function scanIdeaPage(
  ctx: QueryCtx,
  {
    hackathonId,
    includeLegacy,
    filters,
    sortBy,
    paginationOpts,
    categoryId,
  }: {
    hackathonId: Id<"hackathons">;
    includeLegacy: boolean;
    filters?: IdeaListFilters;
    sortBy: IdeaListSortOption;
    paginationOpts: { numItems: number; cursor: string | null };
    categoryId?: Id<"categories">;
  },
) {
  const cursor = parseIdeaScanCursor(paginationOpts.cursor, includeLegacy);
  const scoped: MutableIdeaScanSource = {
    scope: hackathonId,
    cursor: cursor.scoped.cursor,
    exhausted: cursor.scoped.exhausted,
    buffer: await loadIdeaScanBuffer(
      ctx,
      cursor.scoped.bufferedIds,
      hackathonId,
      filters,
      categoryId,
    ),
  };
  const sources = [scoped];
  if (includeLegacy && cursor.legacy) {
    sources.push({
      scope: undefined,
      cursor: cursor.legacy.cursor,
      exhausted: cursor.legacy.exhausted,
      buffer: await loadIdeaScanBuffer(
        ctx,
        cursor.legacy.bufferedIds,
        undefined,
        filters,
        categoryId,
      ),
    });
  }

  const page: Doc<"ideas">[] = [];
  let scannedRows = 0;

  while (page.length < paginationOpts.numItems) {
    let madeProgress = true;
    while (
      sources.some(
        (source) => !source.exhausted && source.buffer.length === 0,
      ) &&
      scannedRows < MAX_IDEA_SCAN_ROWS_PER_PAGE &&
      madeProgress
    ) {
      madeProgress = false;
      for (const source of sources) {
        if (
          source.exhausted ||
          source.buffer.length > 0 ||
          scannedRows >= MAX_IDEA_SCAN_ROWS_PER_PAGE
        ) {
          continue;
        }
        const batchSize = Math.min(
          IDEA_SCAN_CHUNK_SIZE,
          MAX_IDEA_SCAN_ROWS_PER_PAGE - scannedRows,
        );
        const result = await paginateIdeaScanSource(
          ctx,
          source,
          sortBy,
          batchSize,
          categoryId,
        );
        // Charge an attempted batch even if pagination advances across an empty
        // internal page, so the per-request scan loop always remains bounded.
        scannedRows += Math.max(1, result.page.length);
        source.cursor = result.continueCursor;
        source.exhausted = result.isDone;
        source.buffer.push(
          ...result.page.filter((idea) => rawIdeaMatchesFilters(idea, filters)),
        );
        madeProgress = true;
      }
    }

    if (
      sources.some((source) => !source.exhausted && source.buffer.length === 0)
    ) {
      break;
    }

    const available = sources.filter((source) => source.buffer.length > 0);
    if (available.length === 0) break;
    available.sort((left, right) =>
      compareIdeasForSort(left.buffer[0], right.buffer[0], sortBy),
    );
    page.push(available[0].buffer.shift()!);
  }

  const isDone = sources.every(
    (source) => source.exhausted && source.buffer.length === 0,
  );
  const nextCursor: IdeaScanCursor = {
    version: 1,
    scoped: {
      cursor: scoped.cursor,
      exhausted: scoped.exhausted,
      bufferedIds: scoped.buffer.map((idea) => idea._id),
    },
    ...(sources[1]
      ? {
          legacy: {
            cursor: sources[1].cursor,
            exhausted: sources[1].exhausted,
            bufferedIds: sources[1].buffer.map((idea) => idea._id),
          },
        }
      : {}),
  };

  return {
    page,
    isDone,
    continueCursor: JSON.stringify(nextCursor),
  };
}

async function getEffectiveParticipationMode(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons"> | undefined,
  userId: Id<"users">,
  user: { participationMode?: string },
) {
  if (!hackathonId) return user.participationMode;
  const participant = await getParticipant(ctx, hackathonId, userId);
  return participant?.participationMode ?? user.participationMode;
}

async function assertUserOnsiteEligibleForIdea(
  ctx: QueryCtx | MutationCtx,
  idea: Pick<Doc<"ideas">, "hackathonId" | "onsiteOnly">,
  userId: Id<"users">,
  user: { participationMode?: string },
  message: string,
) {
  if (!idea.onsiteOnly) return;
  const mode = await getEffectiveParticipationMode(
    ctx,
    idea.hackathonId,
    userId,
    user,
  );
  if (mode !== "onsite") {
    throw new Error(message);
  }
}

export const create = mutation({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
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
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    if (!hackathon) throw new Error("No hackathon is configured");
    assertIdeaSubmissionsOpenForHackathon(hackathon);
    await requireParticipant(ctx, hackathon._id, userId);
    await assertHackathonWritable(ctx, hackathon._id);
    await assertIdeasUnlocked(ctx, hackathon._id);

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

    await validateRoleSlugs(ctx, args.lookingForRoles, hackathon._id);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");
    const categoryScope = await resolveLegacyScopeForMutation(
      ctx,
      category.hackathonId,
      hackathon._id,
      "Category",
    );
    if (categoryScope.shouldPatch) {
      await ctx.db.patch(category._id, { hackathonId: hackathon._id });
    }

    const isFullAtCreate = args.status === "full";
    const now = Date.now();
    const ideaId = await ctx.db.insert("ideas", {
      hackathonId: hackathon._id,
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
      teamFormationStatus: isFullAtCreate ? "formed" : "forming",
      teamFormationSource: isFullAtCreate ? "auto" : undefined,
      teamFormedAt: isFullAtCreate ? now : undefined,
      roomRequestStatus: isFullAtCreate ? "requested" : "none",
      roomRequestedAt: isFullAtCreate ? now : undefined,
      memberCount: 0,
      interestCount: 0,
      reactionCounts: {},
      reactionTotal: 0,
      filledRoles: [],
      resourceRequestCount: 0,
      hasUnresolvedResources: false,
      needsTeammates:
        args.status !== "full" &&
        args.status !== IDEA_STATUS_SHELVED &&
        args.lookingForRoles.length > 0,
      resourceRequestSummary: [],
    });

    if (args.resourceTags && args.resourceTags.length > 0) {
      const seenTags = new Set<string>();
      const validatedTags: string[] = [];
      for (const tag of args.resourceTags) {
        if (seenTags.has(tag)) continue;
        seenTags.add(tag);
        validatedTags.push(tag);
      }
      await validateResourceSlugs(ctx, validatedTags, hackathon._id);

      const notes = args.resourceNotes
        ? sanitizeText(
            validateStringLength(args.resourceNotes, 0, 1000, "Resource notes"),
          )
        : undefined;

      for (const tag of validatedTags) {
        await ctx.db.insert("resourceRequests", {
          hackathonId: hackathon._id,
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

export const markTeamFormed = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) {
      throw new Error("Only the owner can mark the team formed");
    }
    await assertIdeaMutationAllowed(ctx, idea, userId);

    const now = Date.now();
    await ctx.db.patch(ideaId, {
      teamFormationStatus: "formed",
      teamFormationSource: "owner",
      teamFormedAt: idea.teamFormedAt ?? now,
      roomRequestStatus: idea.roomId ? "assigned" : "requested",
      roomRequestedAt: idea.roomRequestedAt ?? now,
    });
  },
});

export const markTeamForming = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) {
      throw new Error("Only the owner can mark the team forming");
    }
    await assertIdeaMutationAllowed(ctx, idea, userId);
    if (idea.roomId) {
      throw new Error("Unassign the room before marking this team as forming");
    }

    await ctx.db.patch(ideaId, {
      teamFormationStatus: "forming",
      teamFormationSource: undefined,
      teamFormedAt: undefined,
      roomRequestStatus: "none",
      roomRequestedAt: undefined,
    });
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
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);

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

    await validateRoleSlugs(ctx, args.lookingForRoles, hackathonId);
    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category) throw new Error("Category not found");
      const categoryScope = await resolveLegacyScopeForMutation(
        ctx,
        category.hackathonId,
        hackathonId,
        "Category",
      );
      if (categoryScope.shouldPatch) {
        await ctx.db.patch(category._id, { hackathonId });
      }
    }

    const currentFilledRoles = new Set(idea.filledRoles ?? []);
    const needsTeammates =
      args.status !== "full" &&
      args.status !== IDEA_STATUS_SHELVED &&
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
    await refreshIdeaMemberStats(ctx, args.ideaId);
  },
});

export const shelve = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) {
      throw new Error("Only the owner can shelve this idea");
    }
    await assertIdeaMutationAllowed(ctx, idea, userId);

    await ctx.db.patch(ideaId, {
      status: IDEA_STATUS_SHELVED,
      needsTeammates: false,
      teamFormationStatus: "forming",
      teamFormationSource: undefined,
      teamFormedAt: undefined,
      roomRequestStatus: idea.roomId ? "assigned" : "none",
      roomRequestedAt: undefined,
      adminShelvedAt: undefined,
      adminShelvedBy: undefined,
    });
  },
});

export const unshelve = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) {
      throw new Error("Only the owner can unshelve this idea");
    }
    await assertIdeaMutationAllowed(ctx, idea, userId);
    if (idea.status !== IDEA_STATUS_SHELVED) return;

    await ctx.db.patch(ideaId, {
      status: IDEA_STATUS_EXPLORING,
      adminShelvedAt: undefined,
      adminShelvedBy: undefined,
    });
    await refreshIdeaMemberStats(ctx, ideaId);
  },
});

export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) throw new Error("Only the owner can delete");
    await assertIdeaMutationAllowed(ctx, idea, userId);

    await deleteIdeaAndReferences(ctx, ideaId);
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
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);
    if (targetUserId === userId) {
      throw new Error("Choose someone else to own this idea");
    }

    const targetUser = await ctx.db.get(targetUserId);
    if (!targetUser) throw new Error("New owner not found");
    if (!targetUser.email || !isEmailAllowed(targetUser.email)) {
      throw new Error("New owner is not allowed to access this workspace");
    }
    await requireParticipant(ctx, hackathonId, targetUserId);
    await assertUserOnsiteEligibleForIdea(
      ctx,
      idea,
      targetUserId,
      targetUser,
      "This team is limited to on-site participants only. Update your participation mode to on-site in settings to continue.",
    );

    const existingPendingRequest = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .first();
    if (existingPendingRequest) {
      if (
        await shouldPatchLegacyChildScope(
          ctx,
          existingPendingRequest.hackathonId,
          hackathonId,
          "Ownership request",
        )
      ) {
        await ctx.db.patch(existingPendingRequest._id, { hackathonId });
      }
      throw new Error("This idea already has a pending ownership request");
    }

    const requestId = await ctx.db.insert("ownershipTransferRequests", {
      hackathonId,
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

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);
    if (idea.ownerId === userId) {
      throw new Error("You already own this idea");
    }

    const membership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (!membership && idea.status !== IDEA_STATUS_SHELVED) {
      throw new Error("Only team members can request ownership");
    }
    if (
      membership &&
      (await shouldPatchLegacyChildScope(
        ctx,
        membership.hackathonId,
        hackathonId,
        "Membership",
      ))
    ) {
      await ctx.db.patch(membership._id, { hackathonId });
    }
    await assertUserOnsiteEligibleForIdea(
      ctx,
      idea,
      userId,
      user,
      "This team is limited to on-site participants only. Update your participation mode to on-site in settings to continue.",
    );

    const existingPendingRequest = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea_and_status", (q) =>
        q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
      )
      .first();
    if (existingPendingRequest) {
      if (
        await shouldPatchLegacyChildScope(
          ctx,
          existingPendingRequest.hackathonId,
          hackathonId,
          "Ownership request",
        )
      ) {
        await ctx.db.patch(existingPendingRequest._id, { hackathonId });
      }
      throw new Error("This idea already has a pending ownership request");
    }

    const requestId = await ctx.db.insert("ownershipTransferRequests", {
      hackathonId,
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
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);
    if (
      await shouldPatchLegacyChildScope(
        ctx,
        request.hackathonId,
        hackathonId,
        "Ownership request",
      )
    ) {
      await ctx.db.patch(request._id, { hackathonId });
    }

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
    if (!newOwner.email || !isEmailAllowed(newOwner.email)) {
      throw new Error("New owner is not allowed to access this workspace");
    }
    await requireParticipant(ctx, hackathonId, newOwnerId);
    await assertUserOnsiteEligibleForIdea(
      ctx,
      idea,
      newOwnerId,
      newOwner,
      "This team is limited to on-site participants only. Update your participation mode to on-site in settings to continue.",
    );

    const newOwnerMembership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", request.ideaId).eq("userId", newOwnerId),
      )
      .first();
    if (
      newOwnerMembership &&
      (await shouldPatchLegacyChildScope(
        ctx,
        newOwnerMembership.hackathonId,
        hackathonId,
        "Membership",
      ))
    ) {
      await ctx.db.patch(newOwnerMembership._id, { hackathonId });
    }

    if (
      requesterInitiated &&
      !newOwnerMembership &&
      idea.status !== IDEA_STATUS_SHELVED
    ) {
      throw new Error("Requester must still be a team member");
    }

    if (newOwnerMembership && newOwnerMembership.joinedAsOwner !== true) {
      await ctx.db.patch(newOwnerMembership._id, {
        joinedAsOwner: true,
      });
    } else if (!newOwnerMembership && idea.status === IDEA_STATUS_SHELVED) {
      await ctx.db.insert("ideaMembers", {
        hackathonId,
        ideaId: request.ideaId,
        userId: newOwnerId,
        joinedAsOwner: true,
      });
    }

    const targetInterest = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", request.ideaId).eq("userId", newOwnerId),
      )
      .first();
    if (
      targetInterest &&
      (await shouldPatchLegacyChildScope(
        ctx,
        targetInterest.hackathonId,
        hackathonId,
        "Interest",
      ))
    ) {
      await ctx.db.patch(targetInterest._id, { hackathonId });
    }
    if (targetInterest) await ctx.db.delete(targetInterest._id);

    const shouldRemovePreviousOwner = ownerInitiated
      ? request.leaveAfterTransfer
      : leaveAfterTransfer === true;

    const previousOwnerMembership = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", request.ideaId).eq("userId", previousOwnerId),
      )
      .first();
    if (
      previousOwnerMembership &&
      (await shouldPatchLegacyChildScope(
        ctx,
        previousOwnerMembership.hackathonId,
        hackathonId,
        "Membership",
      ))
    ) {
      await ctx.db.patch(previousOwnerMembership._id, { hackathonId });
    }
    if (
      previousOwnerMembership &&
      (shouldRemovePreviousOwner ||
        previousOwnerMembership.joinedAsOwner !== true)
    ) {
      await ctx.db.delete(previousOwnerMembership._id);
    }

    await ctx.db.patch(request.ideaId, {
      ownerId: newOwnerId,
      ...(idea.status === IDEA_STATUS_SHELVED
        ? { status: IDEA_STATUS_EXPLORING }
        : {}),
    });
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
      if (
        await shouldPatchLegacyChildScope(
          ctx,
          otherRequest.hackathonId,
          hackathonId,
          "Ownership request",
        )
      ) {
        await ctx.db.patch(otherRequest._id, { hackathonId });
      }
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
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);
    if (
      await shouldPatchLegacyChildScope(
        ctx,
        request.hackathonId,
        hackathonId,
        "Ownership request",
      )
    ) {
      await ctx.db.patch(request._id, { hackathonId });
    }
    const ownerInitiated = idea.ownerId === request.requesterId;

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
    const hackathonId = await assertIdeaMutationAllowed(ctx, idea, userId);
    if (
      await shouldPatchLegacyChildScope(
        ctx,
        request.hackathonId,
        hackathonId,
        "Ownership request",
      )
    ) {
      await ctx.db.patch(request._id, { hackathonId });
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

const ideaListFiltersValidator = v.object({
  search: v.optional(v.string()),
  shelf: v.optional(v.union(v.literal("active"), v.literal("shelved"))),
  statuses: v.optional(v.array(v.string())),
  roles: v.optional(v.array(v.string())),
  resourceTags: v.optional(v.array(v.string())),
  categories: v.optional(
    v.array(v.union(v.id("categories"), v.literal("__none__"))),
  ),
  needsTeammates: v.optional(v.boolean()),
  needsResources: v.optional(v.boolean()),
});

const ideaListSortValidator = v.union(
  v.literal("newest"),
  v.literal("oldest"),
  v.literal("most_reactions"),
  v.literal("most_interest"),
);

export const list = query({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    paginationOpts: paginationOptsValidator,
    filters: v.optional(ideaListFiltersValidator),
    sortBy: v.optional(ideaListSortValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getIdeaListViewerId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    if (!hackathon) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeasUnlocked(ctx, hackathon?._id);

    const sortBy = args.sortBy ?? "most_interest";
    const filters = normalizeIdeaListFilters(args.filters);
    const includeLegacy = await canReadLegacyScope(ctx, hackathon._id);
    const result = await scanIdeaPage(ctx, {
      hackathonId: hackathon._id,
      includeLegacy,
      filters,
      sortBy,
      paginationOpts: args.paginationOpts,
    });
    return {
      ...result,
      page: await buildIdeaListItems(ctx, result.page, userId, hackathon._id),
    };
  },
});

export const listByCategory = query({
  args: {
    hackathonId: v.optional(v.id("hackathons")),
    categoryId: v.id("categories"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getIdeaListViewerId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const hackathon = await getHackathonByIdOrCurrent(ctx, args.hackathonId);
    if (!hackathon) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeasUnlocked(ctx, hackathon?._id);

    const result = await scanIdeaPage(ctx, {
      hackathonId: hackathon._id,
      includeLegacy: await canReadLegacyScope(ctx, hackathon._id),
      sortBy: "newest",
      paginationOpts: args.paginationOpts,
      categoryId: args.categoryId,
    });
    return {
      ...result,
      page: await buildIdeaListItems(ctx, result.page, userId, hackathon._id),
    };
  },
});

export const get = query({
  args: {
    ideaId: v.id("ideas"),
    hackathonId: v.optional(v.id("hackathons")),
  },
  handler: async (ctx, { ideaId, hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) return null;
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) return null;
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeaInHackathon(ctx, idea, hackathon._id);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const includeLegacy = await canReadLegacyScope(ctx, hackathon._id);
    const isReadableChild = (child: { hackathonId?: Id<"hackathons"> }) =>
      child.hackathonId === hackathon._id ||
      (includeLegacy && child.hackathonId === undefined);

    const owner = await ctx.db.get(idea.ownerId);
    const category = idea.categoryId ? await ctx.db.get(idea.categoryId) : null;

    const members = (
      await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(isReadableChild);

    const isOwner = idea.ownerId === userId;

    const effectiveMembers = members.filter((member) =>
      isEffectiveIdeaMember(member, idea),
    );

    const memberDetails = await Promise.all(
      effectiveMembers.map(async (m) => {
        const [u, participant] = await Promise.all([
          ctx.db.get(m.userId),
          getParticipant(ctx, hackathon._id, m.userId),
        ]);
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
          roles: participant?.roles ?? u?.roles,
          participationMode:
            participant?.participationMode ?? u?.participationMode,
        };
      }),
    );

    const interestDocs = (
      await ctx.db
        .query("ideaInterest")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(isReadableChild);

    const interestedUsers = await Promise.all(
      interestDocs.map(async (i) => {
        const [u, participant] = await Promise.all([
          ctx.db.get(i.userId),
          getParticipant(ctx, hackathon._id, i.userId),
        ]);
        return {
          ...i,
          name: getUserDisplayName(u),
          image: u?.image,
          handle: u?.handle,
          roles: participant?.roles ?? u?.roles,
          participationMode:
            participant?.participationMode ?? u?.participationMode,
        };
      }),
    );

    const reactionDocs = (
      await ctx.db
        .query("reactions")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(isReadableChild);

    const bookmarkDoc = (
      await ctx.db
        .query("ideaBookmarks")
        .withIndex("by_idea_and_user", (q) =>
          q.eq("ideaId", ideaId).eq("userId", userId),
        )
        .collect()
    ).find(isReadableChild);

    const reactionCounts: Record<string, number> = {};
    for (const r of reactionDocs) {
      reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    }
    const resourceNameMap = await getResourceNameMap(ctx, hackathon._id);

    const userReactions = reactionDocs
      .filter((r) => r.userId === userId)
      .map((r) => r.type);

    const resourceDocs = (
      await ctx.db
        .query("resourceRequests")
        .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
        .collect()
    ).filter(isReadableChild);

    const pendingTransferRequest = (
      await ctx.db
        .query("ownershipTransferRequests")
        .withIndex("by_idea_and_status", (q) =>
          q.eq("ideaId", ideaId).eq("status", TRANSFER_STATUS_PENDING),
        )
        .collect()
    ).find(isReadableChild);

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
          roomAddress: roomDoc.address,
          roomDirections: roomDoc.directions,
          roomMapsLink: roomDoc.mapsLink,
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
      teamFormationStatus: idea.teamFormationStatus ?? "forming",
      teamFormationSource: idea.teamFormationSource,
      teamFormedAt: idea.teamFormedAt,
      roomRequestStatus: idea.roomId
        ? "assigned"
        : (idea.roomRequestStatus ?? "none"),
      roomRequestedAt: idea.roomRequestedAt,
      members: memberDetails,
      memberCount: effectiveMembers.length,
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
      hasPendingOwnershipTransfer: pendingTransferRequest !== undefined,
      isMember: effectiveMembers.some((m) => m.userId === userId),
      isInterested: interestDocs.some((i) => i.userId === userId),
      isBookmarked: bookmarkDoc !== undefined,
      isOwner,
      room,
    };
  },
});

export const getAdjacent = query({
  args: {
    ideaId: v.id("ideas"),
    hackathonId: v.optional(v.id("hackathons")),
    filters: v.optional(ideaListFiltersValidator),
    sortBy: v.optional(ideaListSortValidator),
  },
  handler: async (ctx, { ideaId, hackathonId, filters, sortBy }) => {
    await getAuthenticatedUser(ctx);
    const currentIdea = await ctx.db.get(ideaId);
    if (!currentIdea) return { previous: null, next: null };
    await assertIdeaInHackathon(ctx, currentIdea, hackathonId);
    const scopedHackathonId = currentIdea.hackathonId ?? hackathonId;
    await assertIdeasUnlocked(ctx, scopedHackathonId);

    const normalizedFilters = normalizeIdeaListFilters(filters);
    const candidates = scopedHackathonId
      ? await ctx.db
          .query("ideas")
          .withIndex("by_hackathon", (q) =>
            q.eq("hackathonId", scopedHackathonId),
          )
          .take(MAX_CANDIDATE_IDEAS)
      : await ctx.db.query("ideas").take(MAX_CANDIDATE_IDEAS);
    const sortedIdeas = sortRawIdeas(
      candidates.filter((idea) =>
        rawIdeaMatchesFilters(idea, normalizedFilters),
      ),
      sortBy ?? "most_interest",
    );
    const currentIndex = sortedIdeas.findIndex((idea) => idea._id === ideaId);
    if (currentIndex === -1) return { previous: null, next: null };

    const [previous, next] = await Promise.all([
      buildIdeaNavigationItem(ctx, sortedIdeas[currentIndex - 1] ?? null),
      buildIdeaNavigationItem(ctx, sortedIdeas[currentIndex + 1] ?? null),
    ]);

    return { previous, next };
  },
});

export const getByOwner = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathon?._id);
    return hackathon
      ? await ctx.db
          .query("ideas")
          .withIndex("by_hackathon_and_owner", (q) =>
            q.eq("hackathonId", hackathon._id).eq("ownerId", userId),
          )
          .collect()
      : await ctx.db
          .query("ideas")
          .withIndex("by_owner", (q) => q.eq("ownerId", userId))
          .collect();
  },
});

export const getBookmarked = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathon?._id);

    const bookmarks = hackathon
      ? await ctx.db
          .query("ideaBookmarks")
          .withIndex("by_hackathon_and_user", (q) =>
            q.eq("hackathonId", hackathon._id).eq("userId", userId),
          )
          .order("desc")
          .collect()
      : await ctx.db
          .query("ideaBookmarks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .collect();

    const ideas = await Promise.all(bookmarks.map((b) => ctx.db.get(b.ideaId)));
    const existingIdeas = ideas.filter((i): i is Doc<"ideas"> => i !== null);

    if (!hackathon) return [];
    return await buildIdeaListItems(ctx, existingIdeas, userId, hackathon._id);
  },
});
