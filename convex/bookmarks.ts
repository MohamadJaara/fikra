import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUser, getHackathonByIdOrCurrent } from "./lib";

export const toggle = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");

    const existing = await ctx.db
      .query("ideaBookmarks")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("ideaBookmarks", {
      hackathonId: idea.hackathonId,
      ideaId,
      userId,
    });
    return true;
  },
});

export const getByUser = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

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

    const ideas = await Promise.all(
      bookmarks.map(async (b) => {
        const idea = await ctx.db.get(b.ideaId);
        return idea;
      }),
    );

    return ideas.filter((i) => i !== null);
  },
});

export const getBookmarkedIdeaIds = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);

    const bookmarks = hackathon
      ? await ctx.db
          .query("ideaBookmarks")
          .withIndex("by_hackathon_and_user", (q) =>
            q.eq("hackathonId", hackathon._id).eq("userId", userId),
          )
          .collect()
      : await ctx.db
          .query("ideaBookmarks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

    return new Set(bookmarks.map((b) => b.ideaId));
  },
});
