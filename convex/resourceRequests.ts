import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getUserDisplayName,
  sanitizeText,
  RESOURCE_TAGS,
} from "./lib";

export const add = mutation({
  args: {
    ideaId: v.id("ideas"),
    tag: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { ideaId, tag, notes }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId)
      throw new Error("Only the owner can add resource requests");

    if (!RESOURCE_TAGS.includes(tag as (typeof RESOURCE_TAGS)[number])) {
      throw new Error("Invalid resource tag");
    }

    const existing = await ctx.db
      .query("resourceRequests")
      .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
      .collect();

    if (existing.some((r) => r.tag === tag)) {
      throw new Error("Resource request already exists for this tag");
    }

    await ctx.db.insert("resourceRequests", {
      ideaId,
      tag,
      notes: notes ? sanitizeText(notes) : undefined,
      resolved: false,
    });
  },
});

export const resolve = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId)
      throw new Error("Only the owner can resolve resource requests");

    await ctx.db.patch(requestId, { resolved: true });
  },
});

export const unresolve = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId)
      throw new Error("Only the owner can unresolve resource requests");

    await ctx.db.patch(requestId, { resolved: false });
  },
});

export const remove = mutation({
  args: { requestId: v.id("resourceRequests") },
  handler: async (ctx, { requestId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Resource request not found");

    const idea = await ctx.db.get(request.ideaId);
    if (!idea) throw new Error("Idea not found");
    if (idea.ownerId !== userId)
      throw new Error("Only the owner can remove resource requests");

    await ctx.db.delete(requestId);
  },
});

export const getAllUnresolved = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedUser(ctx);

    const unresolved = await ctx.db
      .query("resourceRequests")
      .withIndex("by_resolved", (q) => q.eq("resolved", false))
      .collect();

    const withIdeas = await Promise.all(
      unresolved.map(async (r) => {
        const idea = await ctx.db.get(r.ideaId);
        const owner = idea ? await ctx.db.get(idea.ownerId) : null;
        return {
          ...r,
          ideaTitle: idea?.title || "Unknown",
          ideaId: r.ideaId,
          ownerName: getUserDisplayName(owner),
        };
      }),
    );

    return withIdeas;
  },
});
