import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  assertIdeaInHackathon,
  assertIdeasUnlocked,
  claimLegacyIdeaScopeForMutation,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  getUserDisplayName,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  maxTeamSize,
  requireParticipant,
  resolveLegacyScopeForMutation,
  resolveTeamSize,
} from "./lib";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { refreshIdeaInterestStats, refreshIdeaMemberStats } from "./ideaStats";
import { deleteIdeaAndReferences } from "./ideaLifecycle";

const RELATION_TYPES = ["related", "duplicate"] as const;
type RelationType = (typeof RELATION_TYPES)[number];

const MERGE_STATUS_PENDING = "pending";
const _MERGE_STATUS_ACCEPTED = "accepted";
const MERGE_STATUS_DECLINED = "declined";

export { RELATION_TYPES };

type RelatedIdeaDoc = Doc<"relatedIdeas">;

type RelationPair = {
  relation: RelatedIdeaDoc;
  ideaA: Doc<"ideas">;
  ideaB: Doc<"ideas">;
  hackathonId: Id<"hackathons"> | undefined;
};

function getSharedHackathonId(
  ideaA: Doc<"ideas">,
  ideaB: Doc<"ideas">,
): Id<"hackathons"> | undefined {
  if (ideaA.hackathonId !== ideaB.hackathonId) {
    throw new Error("Ideas must belong to the same hackathon");
  }
  return ideaA.hackathonId;
}

async function loadValidRelationPair(
  ctx: QueryCtx | MutationCtx,
  relationId: Id<"relatedIdeas">,
): Promise<RelationPair> {
  const relation = await ctx.db.get(relationId);
  if (!relation) throw new Error("Relation not found");
  if (relation.ideaIdA === relation.ideaIdB) {
    throw new Error("Invalid idea relation");
  }

  const [ideaA, ideaB] = await Promise.all([
    ctx.db.get(relation.ideaIdA),
    ctx.db.get(relation.ideaIdB),
  ]);
  if (!ideaA || !ideaB) throw new Error("Idea not found");

  const hackathonId = getSharedHackathonId(ideaA, ideaB);
  if (
    relation.hackathonId !== undefined &&
    relation.hackathonId !== hackathonId
  ) {
    throw new Error("Relation does not belong to this hackathon");
  }

  return { relation, ideaA, ideaB, hackathonId };
}

async function assertRelationMutable(
  ctx: MutationCtx,
  pair: RelationPair,
  userId: Id<"users">,
) {
  const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, pair.ideaA);
  await claimLegacyIdeaScopeForMutation(ctx, pair.ideaB, hackathonId);
  const relationScope = await resolveLegacyScopeForMutation(
    ctx,
    pair.relation.hackathonId,
    hackathonId,
    "Relation",
  );
  if (relationScope.shouldPatch) {
    await ctx.db.patch(pair.relation._id, { hackathonId });
  }
  pair.hackathonId = hackathonId;
  await requireParticipant(ctx, hackathonId, userId);
  await assertHackathonWritable(ctx, hackathonId);
  await assertIdeasUnlocked(ctx, hackathonId);
}

async function findExistingRelation(
  ctx: QueryCtx | MutationCtx,
  ideaIdA: Id<"ideas">,
  ideaIdB: Id<"ideas">,
): Promise<RelatedIdeaDoc | null> {
  const [sortedA, sortedB] = orderedPair(ideaIdA, ideaIdB);
  const rows = await ctx.db
    .query("relatedIdeas")
    .withIndex("by_ideaA", (q) => q.eq("ideaIdA", sortedA))
    .collect();
  return rows.find((d) => d.ideaIdB === sortedB) || null;
}

function orderedPair(
  a: Id<"ideas">,
  b: Id<"ideas">,
): [Id<"ideas">, Id<"ideas">] {
  return String(a) < String(b) ? [a, b] : [b, a];
}

export const markRelated = mutation({
  args: {
    ideaIdA: v.id("ideas"),
    ideaIdB: v.id("ideas"),
    relationType: v.string(),
  },
  handler: async (ctx, { ideaIdA, ideaIdB, relationType }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    if (ideaIdA === ideaIdB) throw new Error("Cannot relate an idea to itself");

    if (!RELATION_TYPES.includes(relationType as RelationType)) {
      throw new Error("Invalid relation type");
    }

    const [ideaA, ideaB] = await Promise.all([
      ctx.db.get(ideaIdA),
      ctx.db.get(ideaIdB),
    ]);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

    if (ideaA.ownerId !== userId && ideaB.ownerId !== userId) {
      throw new Error("Only idea owners can relate ideas");
    }
    if (ideaA.hackathonId !== undefined && ideaB.hackathonId !== undefined) {
      getSharedHackathonId(ideaA, ideaB);
    }
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, ideaA);
    await claimLegacyIdeaScopeForMutation(ctx, ideaB, hackathonId);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);

    const existing = await findExistingRelation(ctx, ideaIdA, ideaIdB);
    if (existing) throw new Error("These ideas are already related");

    const [sortedA, sortedB] = orderedPair(ideaIdA, ideaIdB);

    await ctx.db.insert("relatedIdeas", {
      hackathonId,
      ideaIdA: sortedA,
      ideaIdB: sortedB,
      markedByUserId: userId,
      relationType,
    });

    const otherOwnerId =
      ideaA.ownerId === userId ? ideaB.ownerId : ideaA.ownerId;
    const targetIdeaId = ideaA.ownerId === userId ? ideaIdB : ideaIdA;

    if (otherOwnerId !== userId) {
      await ctx.runMutation(internal.notifications.create, {
        recipientId: otherOwnerId,
        actorId: userId,
        ideaId: targetIdeaId,
        type: "ideas_related",
      });
    }
  },
});

export const removeRelation = mutation({
  args: { relationId: v.id("relatedIdeas") },
  handler: async (ctx, { relationId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const pair = await loadValidRelationPair(ctx, relationId);
    const { ideaA, ideaB } = pair;

    const isOwnerOfEither =
      ideaA.ownerId === userId || ideaB.ownerId === userId;
    if (!isOwnerOfEither) {
      throw new Error("Only idea owners can remove relations");
    }
    await assertRelationMutable(ctx, pair, userId);

    await ctx.db.delete(relationId);
  },
});

export const requestMerge = mutation({
  args: { relationId: v.id("relatedIdeas") },
  handler: async (ctx, { relationId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const pair = await loadValidRelationPair(ctx, relationId);
    const { relation, ideaA, ideaB } = pair;
    await assertRelationMutable(ctx, pair, userId);

    if (relation.relationType !== "duplicate") {
      throw new Error("Can only request merge on duplicate relations");
    }
    if (relation.mergeStatus) {
      throw new Error("Merge already requested for this relation");
    }

    if (ideaA.ownerId !== userId && ideaB.ownerId !== userId) {
      throw new Error("Only an idea owner can request a merge");
    }
    if (ideaA.ownerId === ideaB.ownerId) {
      throw new Error("Ideas with the same owner cannot be merged");
    }

    const targetId =
      ideaA.ownerId === userId ? relation.ideaIdB : relation.ideaIdA;
    const targetDoc = ideaA.ownerId === userId ? ideaB : ideaA;

    await ctx.db.patch(relationId, {
      mergeRequestedById: userId,
      mergeStatus: MERGE_STATUS_PENDING,
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: targetDoc.ownerId,
      actorId: userId,
      ideaId: targetId,
      type: "merge_requested",
    });
  },
});

export const acceptMerge = mutation({
  args: { relationId: v.id("relatedIdeas") },
  handler: async (ctx, { relationId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const pair = await loadValidRelationPair(ctx, relationId);
    const { relation, ideaA, ideaB } = pair;
    await assertRelationMutable(ctx, pair, userId);
    if (relation.mergeStatus !== MERGE_STATUS_PENDING) {
      throw new Error("No pending merge request");
    }
    if (!relation.mergeRequestedById) {
      throw new Error("Invalid merge request");
    }

    const sourceId =
      ideaA.ownerId === relation.mergeRequestedById
        ? relation.ideaIdA
        : relation.ideaIdB;
    const sourceDoc =
      ideaA.ownerId === relation.mergeRequestedById ? ideaA : ideaB;
    const targetId =
      ideaA.ownerId === relation.mergeRequestedById
        ? relation.ideaIdB
        : relation.ideaIdA;
    const targetDoc =
      ideaA.ownerId === relation.mergeRequestedById ? ideaB : ideaA;

    if (sourceDoc.ownerId !== relation.mergeRequestedById) {
      throw new Error(
        "Merge requester no longer owns the source idea. Please re-request the merge.",
      );
    }

    if (targetDoc.ownerId !== userId) {
      throw new Error("Only the owner of the target idea can accept the merge");
    }

    if (userId === relation.mergeRequestedById) {
      throw new Error("You cannot accept your own merge request");
    }

    const sourceMembers = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();

    for (const member of sourceMembers.filter((sourceMember) =>
      isEffectiveIdeaMember(sourceMember, sourceDoc),
    )) {
      const sourceRoles = mergeUniqueStringArrays(
        member.memberRoles,
        member.role ? [member.role] : undefined,
      );
      const existing = await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea_and_user", (q) =>
          q.eq("ideaId", targetId).eq("userId", member.userId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("ideaMembers", {
          hackathonId: targetDoc.hackathonId,
          ideaId: targetId,
          userId: member.userId,
          memberRoles: sourceRoles,
          joinedAsOwner: member.userId === targetDoc.ownerId ? true : undefined,
        });
        continue;
      }

      const existingRoles = mergeUniqueStringArrays(
        existing.memberRoles,
        existing.role ? [existing.role] : undefined,
      );
      const mergedRoles = mergeUniqueStringArrays(existingRoles, sourceRoles);
      const rolesChanged =
        (existingRoles ?? []).length !== (mergedRoles ?? []).length ||
        (existingRoles ?? []).some(
          (role, index) => mergedRoles?.[index] !== role,
        );
      const joinedAsOwnerChanged =
        member.userId === targetDoc.ownerId && existing.joinedAsOwner !== true;
      const hackathonChanged = existing.hackathonId !== targetDoc.hackathonId;

      if (
        existing.role !== undefined ||
        rolesChanged ||
        joinedAsOwnerChanged ||
        hackathonChanged
      ) {
        await ctx.db.patch(existing._id, {
          hackathonId: targetDoc.hackathonId,
          memberRoles: mergedRoles,
          role: undefined,
          joinedAsOwner: joinedAsOwnerChanged ? true : existing.joinedAsOwner,
        });
      }
    }

    const sourceInterests = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();

    for (const interest of sourceInterests) {
      const existing = await ctx.db
        .query("ideaInterest")
        .withIndex("by_idea_and_user", (q) =>
          q.eq("ideaId", targetId).eq("userId", interest.userId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("ideaInterest", {
          hackathonId: targetDoc.hackathonId,
          ideaId: targetId,
          userId: interest.userId,
        });
      } else if (existing.hackathonId !== targetDoc.hackathonId) {
        await ctx.db.patch(existing._id, {
          hackathonId: targetDoc.hackathonId,
        });
      }
    }

    const skillsSet = new Set([
      ...targetDoc.skillsNeeded,
      ...sourceDoc.skillsNeeded,
    ]);
    const rolesSet = new Set([
      ...targetDoc.lookingForRoles,
      ...sourceDoc.lookingForRoles,
    ]);
    const newTeamSize = maxTeamSize(
      resolveTeamSize(targetDoc),
      resolveTeamSize(sourceDoc),
    );

    await ctx.db.patch(targetId, {
      skillsNeeded: [...skillsSet],
      lookingForRoles: [...rolesSet],
      teamSize: newTeamSize,
      teamSizeWanted: undefined,
    });

    await deleteIdeaAndReferences(ctx, sourceId);

    await refreshIdeaMemberStats(ctx, targetId);
    await refreshIdeaInterestStats(ctx, targetId);

    await ctx.runMutation(internal.notifications.create, {
      recipientId: relation.mergeRequestedById,
      actorId: userId,
      ideaId: targetId,
      type: "merge_accepted",
    });

    for (const member of sourceMembers) {
      if (member.userId !== relation.mergeRequestedById) {
        await ctx.runMutation(internal.notifications.create, {
          recipientId: member.userId,
          actorId: userId,
          ideaId: targetId,
          type: "merge_accepted",
        });
      }
    }
  },
});

export const declineMerge = mutation({
  args: { relationId: v.id("relatedIdeas") },
  handler: async (ctx, { relationId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const pair = await loadValidRelationPair(ctx, relationId);
    const { relation, ideaA, ideaB } = pair;
    await assertRelationMutable(ctx, pair, userId);
    if (relation.mergeStatus !== MERGE_STATUS_PENDING) {
      throw new Error("No pending merge request");
    }
    if (!relation.mergeRequestedById) {
      throw new Error("Invalid merge request");
    }

    const targetDoc =
      ideaA.ownerId === relation.mergeRequestedById ? ideaB : ideaA;

    if (targetDoc.ownerId !== userId) {
      throw new Error(
        "Only the owner of the target idea can decline the merge",
      );
    }

    await ctx.db.patch(relationId, {
      mergeStatus: MERGE_STATUS_DECLINED,
    });

    await ctx.runMutation(internal.notifications.create, {
      recipientId: relation.mergeRequestedById,
      actorId: userId,
      ideaId:
        ideaA.ownerId === relation.mergeRequestedById
          ? relation.ideaIdB
          : relation.ideaIdA,
      type: "merge_declined",
    });
  },
});

export const listForIdea = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathon = await getHackathonByIdOrCurrent(ctx, idea.hackathonId);
    if (!hackathon) return [];
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeaInHackathon(ctx, idea, hackathon._id);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const isReadableScope = (scope: Id<"hackathons">) =>
      scope === hackathon._id;

    const asA = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q) => q.eq("ideaIdA", ideaId))
      .collect();
    const asB = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q) => q.eq("ideaIdB", ideaId))
      .collect();

    const all = [...asA, ...asB];

    const results = await Promise.all(
      all.map(async (rel) => {
        const otherId = rel.ideaIdA === ideaId ? rel.ideaIdB : rel.ideaIdA;
        const otherIdea = await ctx.db.get(otherId);
        if (
          rel.ideaIdA === rel.ideaIdB ||
          !otherIdea ||
          !isReadableScope(otherIdea.hackathonId) ||
          !isReadableScope(rel.hackathonId)
        ) {
          return null;
        }
        const otherOwner = otherIdea
          ? await ctx.db.get(otherIdea.ownerId)
          : null;
        const markedBy = await ctx.db.get(rel.markedByUserId);
        const mergeRequester = rel.mergeRequestedById
          ? await ctx.db.get(rel.mergeRequestedById)
          : null;

        let sourceIdeaId: Id<"ideas"> | null = null;
        if (rel.mergeRequestedById && otherIdea) {
          sourceIdeaId =
            otherIdea.ownerId === rel.mergeRequestedById ? otherId : ideaId;
        }

        const otherMemberCount = (
          await ctx.db
            .query("ideaMembers")
            .withIndex("by_idea", (q) => q.eq("ideaId", otherId))
            .collect()
        ).filter((member) => isReadableScope(member.hackathonId)).length;

        return {
          _id: rel._id,
          _creationTime: rel._creationTime,
          relationType: rel.relationType,
          mergeStatus: rel.mergeStatus ?? null,
          mergeRequestedById: rel.mergeRequestedById ?? null,
          mergeRequesterName: mergeRequester
            ? getUserDisplayName(mergeRequester)
            : null,
          markedByName: getUserDisplayName(markedBy),
          otherIdeaId: otherId,
          otherIdeaTitle: otherIdea.title,
          otherIdeaStatus: otherIdea.status,
          otherIdeaOwnerId: otherIdea.ownerId,
          otherOwnerName: getUserDisplayName(otherOwner),
          otherOwnerImage: otherOwner?.image,
          otherOwnerHandle: otherOwner?.handle,
          otherMemberCount,
          sourceIdeaId,
        };
      }),
    );
    return results.filter((result) => result !== null);
  },
});

export const searchPotentialDuplicates = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) throw new Error("Only the owner can search");
    const hackathon = await getHackathonByIdOrCurrent(ctx, idea.hackathonId);
    if (!hackathon) return [];
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeaInHackathon(ctx, idea, hackathon._id);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const titleWords = idea.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (titleWords.length === 0) return [];

    const candidates = await ctx.db
      .query("ideas")
      .withSearchIndex("search_title_by_hackathon", (q) =>
        q
          .search("title", titleWords.join(" "))
          .eq("hackathonId", idea.hackathonId),
      )
      .take(20);

    const scored = candidates
      .filter((i) => i._id !== ideaId && i.hackathonId === idea.hackathonId)
      .map((i) => {
        const otherWords = i.title.toLowerCase().split(/\s+/);
        const otherLower = i.title.toLowerCase();
        const pitchLower = i.pitch.toLowerCase();
        let score = 0;

        for (const word of titleWords) {
          if (otherLower.includes(word)) score += 2;
        }

        for (const word of otherWords) {
          if (word.length > 3 && idea.title.toLowerCase().includes(word)) {
            score += 1;
          }
        }

        const problemWords = idea.problem
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 4);
        for (const word of problemWords) {
          if (
            pitchLower.includes(word) ||
            i.problem.toLowerCase().includes(word)
          )
            score += 1;
        }

        return { idea: i, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return await Promise.all(
      scored.map(async ({ idea: i, score }) => {
        const owner = await ctx.db.get(i.ownerId);
        const members = await ctx.db
          .query("ideaMembers")
          .withIndex("by_idea", (q) => q.eq("ideaId", i._id))
          .collect();
        const memberCount = members.filter(
          (member) =>
            member.hackathonId === hackathon._id &&
            isEffectiveIdeaMember(member, i),
        ).length;
        return {
          _id: i._id,
          title: i.title,
          pitch: i.pitch,
          status: i.status,
          ownerName: getUserDisplayName(owner),
          memberCount,
          score,
        };
      }),
    );
  },
});
