import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  resolveTeamSize,
} from "./lib";

const MIN_AUTO_FORMED_MEMBERS = 2;

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
  const idea = await ctx.db.get(ideaId);
  const effectiveMembers = idea
    ? members.filter((member) => isEffectiveIdeaMember(member, idea))
    : members;
  const filledRoles = new Set<string>();
  for (const member of effectiveMembers) {
    for (const role of mergeUniqueStringArrays(
      member.memberRoles,
      member.role ? [member.role] : undefined,
    ) ?? []) {
      filledRoles.add(role);
    }
  }
  const needsTeammates =
    !!idea &&
    idea.status !== "full" &&
    idea.status !== "shelved" &&
    idea.lookingForRoles.some((role) => !filledRoles.has(role));
  const patch: Partial<Doc<"ideas">> = {
    memberCount: effectiveMembers.length,
    filledRoles: [...filledRoles],
    needsTeammates,
  };

  if (idea) {
    const requiredRolesFilled =
      idea.lookingForRoles.length > 0 &&
      idea.lookingForRoles.every((role) => filledRoles.has(role));
    const soloReady =
      resolveTeamSize(idea) === "solo" && effectiveMembers.length >= 1;
    const hasEnoughPeople = effectiveMembers.length >= MIN_AUTO_FORMED_MEMBERS;
    const autoFormed =
      idea.status !== "shelved" &&
      (idea.status === "full" ||
        soloReady ||
        hasEnoughPeople ||
        (effectiveMembers.length > 0 && requiredRolesFilled));
    const isManuallyFormed =
      idea.teamFormationStatus === "formed" &&
      idea.teamFormationSource === "owner";
    const hasAssignedRoom =
      idea.roomId !== undefined || idea.roomRequestStatus === "assigned";

    if (isManuallyFormed) {
      patch.roomRequestStatus = hasAssignedRoom ? "assigned" : "requested";
      patch.roomRequestedAt = idea.roomRequestedAt ?? Date.now();
    } else if (autoFormed) {
      patch.teamFormationStatus = "formed";
      patch.teamFormationSource = "auto";
      patch.teamFormedAt = idea.teamFormedAt ?? Date.now();
      patch.roomRequestStatus = hasAssignedRoom ? "assigned" : "requested";
      patch.roomRequestedAt = idea.roomRequestedAt ?? Date.now();
    } else if (idea.teamFormationSource === "auto") {
      patch.teamFormationStatus = "forming";
      patch.teamFormationSource = undefined;
      patch.teamFormedAt = undefined;
      if (!hasAssignedRoom) {
        patch.roomRequestStatus = "none";
        patch.roomRequestedAt = undefined;
      }
    }
  }

  await ctx.db.patch(ideaId, patch);
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
