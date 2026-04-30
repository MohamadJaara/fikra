import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mergeUniqueStringArrays } from "./lib";

export type ResourceRequestSummary = NonNullable<
  Doc<"ideas">["resourceRequestSummary"]
>[number];

export function summarizeResourceRequest(
  resource: Doc<"resourceRequests">,
): ResourceRequestSummary {
  return {
    _id: resource._id,
    _creationTime: resource._creationTime,
    ideaId: resource.ideaId,
    tag: resource.tag,
    notes: resource.notes,
    resolved: resource.resolved,
  };
}

export async function getResourceRequestSummary(
  ctx: QueryCtx,
  idea: Doc<"ideas">,
): Promise<ResourceRequestSummary[]> {
  if (idea.resourceRequestSummary !== undefined) {
    return idea.resourceRequestSummary;
  }

  const resourceDocs = await ctx.db
    .query("resourceRequests")
    .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
    .collect();

  return resourceDocs.map(summarizeResourceRequest);
}

export async function refreshIdeaMemberStats(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const members = await ctx.db
    .query("ideaMembers")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .collect();
  const filledRoles = new Set<string>();
  for (const member of members) {
    for (const role of mergeUniqueStringArrays(
      member.memberRoles,
      member.role ? [member.role] : undefined,
    ) ?? []) {
      filledRoles.add(role);
    }
  }
  const idea = await ctx.db.get(ideaId);
  const needsTeammates =
    !!idea &&
    idea.status !== "full" &&
    idea.lookingForRoles.some((role) => !filledRoles.has(role));
  await ctx.db.patch(ideaId, {
    memberCount: members.length,
    filledRoles: [...filledRoles],
    needsTeammates,
  });
}

export async function refreshIdeaInterestStats(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const interestCount = (
    await ctx.db
      .query("ideaInterest")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect()
  ).length;
  await ctx.db.patch(ideaId, { interestCount });
}

export async function refreshIdeaReactionStats(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .collect();
  const reactionCounts: Record<string, number> = {};
  let reactionTotal = 0;
  for (const reaction of reactions) {
    reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
    reactionTotal++;
  }
  await ctx.db.patch(ideaId, { reactionCounts, reactionTotal });
}

export async function refreshIdeaResourceStats(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const resources = await ctx.db
    .query("resourceRequests")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .collect();
  await ctx.db.patch(ideaId, {
    resourceRequestCount: resources.length,
    hasUnresolvedResources: resources.some((r) => !r.resolved),
    resourceRequestSummary: resources.map(summarizeResourceRequest),
  });
}
