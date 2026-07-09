import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { deleteNotificationsForIdea } from "./notifications";

/**
 * Deletes an idea and every document whose lifecycle is owned by that idea.
 * Authorization and hackathon write checks belong to the caller.
 */
export async function deleteIdeaAndReferences(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const [
    members,
    interests,
    comments,
    reactions,
    resourceRequests,
    ownershipTransferRequests,
    relationsAsA,
    relationsAsB,
    dismissedIdeas,
    bookmarks,
    votes,
  ] = await Promise.all([
    ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("comments")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("reactions")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("ownershipTransferRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q) => q.eq("ideaIdA", ideaId))
      .collect(),
    ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q) => q.eq("ideaIdB", ideaId))
      .collect(),
    ctx.db
      .query("dismissedIdeas")
      .withIndex("by_idea_and_user", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("ideaBookmarks")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect(),
    ctx.db
      .query("ideaVotes")
      .withIndex("by_idea_and_round", (q) => q.eq("ideaId", ideaId))
      .collect(),
  ]);

  await deleteNotificationsForIdea(ctx, ideaId);

  for (const document of [
    ...members,
    ...interests,
    ...comments,
    ...reactions,
    ...resourceRequests,
    ...ownershipTransferRequests,
    ...dismissedIdeas,
    ...bookmarks,
    ...votes,
  ]) {
    await ctx.db.delete(document._id);
  }

  const relationIds = new Set<Id<"relatedIdeas">>();
  for (const relation of [...relationsAsA, ...relationsAsB]) {
    relationIds.add(relation._id);
  }
  for (const relationId of relationIds) {
    await ctx.db.delete(relationId);
  }

  await ctx.db.delete(ideaId);
}
