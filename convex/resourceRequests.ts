import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  assertHackathonWritable,
  getAuthenticatedUser,
  getResourceNameMap,
  getUserDisplayName,
  sanitizeText,
  validateResourceSlugs,
} from "./lib";
import { refreshIdeaResourceStats } from "./ideaStats";

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
    await assertHackathonWritable(ctx, idea.hackathonId, user);
    if (idea.ownerId !== userId && !user.isAdmin) {
      throw new Error("Only the owner or an admin can add resource requests");
    }

    await validateResourceSlugs(ctx, [tag], idea.hackathonId);

    const existing = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    if (existing.some((r) => r.tag === tag)) {
      throw new Error("Resource request already exists for this tag");
    }

    await ctx.db.insert("resourceRequests", {
      hackathonId: idea.hackathonId,
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
    await assertHackathonWritable(ctx, idea.hackathonId, user);
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
    await assertHackathonWritable(ctx, idea.hackathonId, user);
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
    await assertHackathonWritable(ctx, idea.hackathonId, user);
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
    await getAuthenticatedUser(ctx);
    const resourceNameMap = await getResourceNameMap(ctx, hackathonId);

    const unresolved = hackathonId
      ? await ctx.db
          .query("resourceRequests")
          .withIndex("by_hackathon_and_resolved", (q) =>
            q.eq("hackathonId", hackathonId).eq("resolved", false),
          )
          .collect()
      : await ctx.db
          .query("resourceRequests")
          .withIndex("by_resolved", (q) => q.eq("resolved", false))
          .collect();

    const withIdeas = await Promise.all(
      unresolved.map(async (r) => {
        const idea = await ctx.db.get(r.ideaId);
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

    return withIdeas;
  },
});
