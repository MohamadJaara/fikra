import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  assertHackathonWritable,
  assertIdeasUnlocked,
  claimLegacyIdeaScopeForMutation,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  getResourceNameMap,
  getUserDisplayName,
  requireParticipant,
  resolveLegacyScopeForMutation,
  sanitizeText,
  validateResourceSlugs,
} from "./lib";
import { refreshIdeaResourceStats } from "./ideaStats";

async function assertRequestHackathon(
  ctx: MutationCtx,
  request: { _id: Id<"resourceRequests">; hackathonId: Id<"hackathons"> },
  hackathonId: Id<"hackathons">,
) {
  const requestScope = await resolveLegacyScopeForMutation(
    ctx,
    request.hackathonId,
    hackathonId,
    "Resource request",
  );
  if (requestScope.shouldPatch) {
    await ctx.db.patch(request._id, { hackathonId });
  }
}

export const add = mutation({
  args: {
    ideaId: v.id("ideas"),
    tag: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { ideaId, tag, notes }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);
    if (idea.ownerId !== userId && !user.isAdmin) {
      throw new Error("Only the owner or an admin can add resource requests");
    }

    await validateResourceSlugs(ctx, [tag], hackathonId);

    const existing = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    for (const request of existing) {
      await assertRequestHackathon(ctx, request, hackathonId);
    }
    if (existing.some((r) => r.tag === tag)) {
      throw new Error("Resource request already exists for this tag");
    }

    await ctx.db.insert("resourceRequests", {
      hackathonId,
      ideaId,
      tag,
      notes: notes ? sanitizeText(notes) : undefined,
      resolved: false,
    });
    await refreshIdeaResourceStats(ctx, ideaId);
  },
});

export const resolve = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await assertRequestHackathon(ctx, request, hackathonId);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);
    if (idea.ownerId !== userId && !user.isAdmin) {
      throw new Error(
        "Only the owner or an admin can resolve resource requests",
      );
    }

    await ctx.db.patch(requestId, { resolved: true });
    await refreshIdeaResourceStats(ctx, request.ideaId);
  },
});

export const unresolve = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await assertRequestHackathon(ctx, request, hackathonId);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);
    if (idea.ownerId !== userId && !user.isAdmin) {
      throw new Error(
        "Only the owner or an admin can unresolve resource requests",
      );
    }

    await ctx.db.patch(requestId, { resolved: false });
    await refreshIdeaResourceStats(ctx, request.ideaId);
  },
});

export const remove = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId, user } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    const hackathonId = await claimLegacyIdeaScopeForMutation(ctx, idea);
    await assertRequestHackathon(ctx, request, hackathonId);
    await requireParticipant(ctx, hackathonId, userId);
    await assertHackathonWritable(ctx, hackathonId);
    await assertIdeasUnlocked(ctx, hackathonId);
    if (idea.ownerId !== userId && !user.isAdmin) {
      throw new Error(
        "Only the owner or an admin can remove resource requests",
      );
    }

    await ctx.db.delete(requestId);
    await refreshIdeaResourceStats(ctx, request.ideaId);
  },
});

export const getAllUnresolved = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    if (!hackathon) return [];
    await requireParticipant(ctx, hackathon._id, userId);
    await assertIdeasUnlocked(ctx, hackathon._id);
    const resourceNameMap = await getResourceNameMap(ctx, hackathon._id);
    const unresolved = await ctx.db
      .query("resourceRequests")
      .withIndex("by_hackathon_and_resolved", (q) =>
        q.eq("hackathonId", hackathon._id).eq("resolved", false),
      )
      .collect();

    const withIdeas = await Promise.all(
      unresolved.map(async (r) => {
        const idea = await ctx.db.get(r.ideaId);
        if (!idea || idea.hackathonId !== hackathon._id) {
          return null;
        }
        const owner = idea ? await ctx.db.get(idea.ownerId) : null;
        return {
          ...r,
          resourceName: resourceNameMap[r.tag] || r.tag,
          ideaTitle: idea?.title || "Unknown",
          ideaId: r.ideaId,
          ownerName: getUserDisplayName(owner),
        };
      }),
    );

    return withIdeas.filter((request) => request !== null);
  },
});
