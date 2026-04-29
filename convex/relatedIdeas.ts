import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getUserDisplayName,
  mergeUniqueStringArrays,
  maxTeamSize,
  resolveTeamSize,
} from "./lib";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import {
  refreshIdeaInterestStats,
  refreshIdeaMemberStats,
} from "./ideaStats";

const RELATION_TYPES = ["related", "duplicate"] as const;
type RelationType = (typeof RELATION_TYPES)[number];

const MERGE_STATUS_PENDING = "pending";
const MERGE_STATUS_ACCEPTED = "accepted";
const MERGE_STATUS_DECLINED = "declined";

export { RELATION_TYPES };

type RelatedIdeaDoc = Doc<"relatedIdeas">;

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

    const ideaA = await ctx.db.get(ideaIdA);
    const ideaB = await ctx.db.get(ideaIdB);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

    const existing = await findExistingRelation(ctx, ideaIdA, ideaIdB);
    if (existing) throw new Error("These ideas are already related");

    const [sortedA, sortedB] = orderedPair(ideaIdA, ideaIdB);

    await ctx.db.insert("relatedIdeas", {
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
    const relation = await ctx.db.get(relationId);
    if (!relation) throw new Error("Relation not found");

    const ideaA = await ctx.db.get(relation.ideaIdA);
    const ideaB = await ctx.db.get(relation.ideaIdB);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

    const isOwnerOfEither =
      ideaA.ownerId === userId || ideaB.ownerId === userId;
    if (!isOwnerOfEither) {
      throw new Error("Only idea owners can remove relations");
    }

    await ctx.db.delete(relationId);
  },
});

export const requestMerge = mutation({
  args: { relationId: v.id("relatedIdeas") },
  handler: async (ctx, { relationId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const relation = await ctx.db.get(relationId);
    if (!relation) throw new Error("Relation not found");

    if (relation.relationType !== "duplicate") {
      throw new Error("Can only request merge on duplicate relations");
    }
    if (relation.mergeStatus) {
      throw new Error("Merge already requested for this relation");
    }

    const ideaA = await ctx.db.get(relation.ideaIdA);
    const ideaB = await ctx.db.get(relation.ideaIdB);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

    if (ideaA.ownerId !== userId && ideaB.ownerId !== userId) {
      throw new Error("Only an idea owner can request a merge");
    }

    const sourceId =
      ideaA.ownerId === userId ? relation.ideaIdA : relation.ideaIdB;
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
    const relation = await ctx.db.get(relationId);
    if (!relation) throw new Error("Relation not found");
    if (relation.mergeStatus !== MERGE_STATUS_PENDING) {
      throw new Error("No pending merge request");
    }
    if (!relation.mergeRequestedById) {
      throw new Error("Invalid merge request");
    }

    const ideaA = await ctx.db.get(relation.ideaIdA);
    const ideaB = await ctx.db.get(relation.ideaIdB);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

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

    for (const member of sourceMembers) {
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
          ideaId: targetId,
          userId: member.userId,
          memberRoles: sourceRoles,
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
        (existingRoles ?? []).some((role, index) => mergedRoles?.[index] !== role);

      if (existing.role !== undefined || rolesChanged) {
        await ctx.db.patch(existing._id, {
          memberRoles: mergedRoles,
          role: undefined,
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
          ideaId: targetId,
          userId: interest.userId,
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

    const sourceComments = await ctx.db
      .query("comments")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const c of sourceComments) await ctx.db.delete(c._id);

    const sourceReactions = await ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const r of sourceReactions) await ctx.db.delete(r._id);

    const sourceResources = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const r of sourceResources) await ctx.db.delete(r._id);

    await ctx.runMutation(internal.notifications.deleteForIdea, {
      ideaId: sourceId,
    });

    const sourceInterestDocs = await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const i of sourceInterestDocs) await ctx.db.delete(i._id);

    const sourceMemberDocs = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const m of sourceMemberDocs) await ctx.db.delete(m._id);

    const sourceTransferReqs = await ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", sourceId))
      .collect();
    for (const t of sourceTransferReqs) await ctx.db.delete(t._id);

    const relatedRows = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q) => q.eq("ideaIdA", sourceId))
      .collect();
    const relatedRowsB = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q) => q.eq("ideaIdB", sourceId))
      .collect();
    for (const r of [...relatedRows, ...relatedRowsB]) {
      await ctx.db.delete(r._id);
    }

    await ctx.db.delete(sourceId);

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
    const relation = await ctx.db.get(relationId);
    if (!relation) throw new Error("Relation not found");
    if (relation.mergeStatus !== MERGE_STATUS_PENDING) {
      throw new Error("No pending merge request");
    }
    if (!relation.mergeRequestedById) {
      throw new Error("Invalid merge request");
    }

    const ideaA = await ctx.db.get(relation.ideaIdA);
    const ideaB = await ctx.db.get(relation.ideaIdB);
    if (!ideaA || !ideaB) throw new Error("Idea not found");

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
    await getAuthenticatedUser(ctx);

    const asA = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q) => q.eq("ideaIdA", ideaId))
      .collect();
    const asB = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q) => q.eq("ideaIdB", ideaId))
      .collect();

    const all = [...asA, ...asB];

    return await Promise.all(
      all.map(async (rel) => {
        const otherId = rel.ideaIdA === ideaId ? rel.ideaIdB : rel.ideaIdA;
        const otherIdea = await ctx.db.get(otherId);
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

        const otherMemberCount = otherIdea
          ? (
              await ctx.db
                .query("ideaMembers")
                .withIndex("by_idea", (q) => q.eq("ideaId", otherId))
                .collect()
            ).length
          : 0;

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
          otherIdeaTitle: otherIdea?.title || "Deleted",
          otherIdeaStatus: otherIdea?.status || null,
          otherIdeaOwnerId: otherIdea?.ownerId || null,
          otherOwnerName: getUserDisplayName(otherOwner),
          otherOwnerImage: otherOwner?.image,
          otherOwnerHandle: otherOwner?.handle,
          otherMemberCount,
          sourceIdeaId,
        };
      }),
    );
  },
});

export const searchPotentialDuplicates = query({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId) throw new Error("Only the owner can search");

    const titleWords = idea.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (titleWords.length === 0) return [];

    const candidates = await ctx.db
      .query("ideas")
      .withSearchIndex("search_title", (q) =>
        q.search("title", titleWords.join(" ")),
      )
      .take(20);

    const scored = candidates
      .filter((i) => i._id !== ideaId)
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
        const memberCount = (
          await ctx.db
            .query("ideaMembers")
            .withIndex("by_idea", (q) => q.eq("ideaId", i._id))
            .collect()
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
