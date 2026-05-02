import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getAuthenticatedUser,
  getUserDisplayName,
  getResourceNameMap,
  resolveTeamSize,
} from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

const MAX_DISCOVER_IDEAS = 50;

type DiscoverIdea = {
  _id: Id<"ideas">;
  _creationTime: number;
  title: string;
  pitch: string;
  problem: string;
  targetAudience: string;
  skillsNeeded: string[];
  teamSize: string;
  status: string;
  lookingForRoles: string[];
  ownerId: Id<"users">;
  categoryId?: Id<"categories">;
  categoryName?: string;
  ownerName: string;
  ownerImage?: string;
  ownerHandle?: string;
  memberCount: number;
  interestCount: number;
  reactionCounts: Record<string, number>;
  missingRoles: string[];
  hasUnresolvedResources: boolean;
  isMember: boolean;
  isInterested: boolean;
  isOwner: boolean;
  onsiteOnly?: boolean;
  trendingScore: number;
  roleMatchCount: number;
};

async function enrichDiscoverIdea(
  ctx: any,
  idea: Doc<"ideas">,
  userId: Id<"users">,
  userRoles: string[],
  memberIdeaIds: Set<Id<"ideas">>,
  interestedIdeaIds: Set<Id<"ideas">>,
): Promise<DiscoverIdea> {
  const owner = await ctx.db.get(idea.ownerId);
  const category = idea.categoryId
    ? await ctx.db.get(idea.categoryId)
    : null;

  const filledRoles = new Set(idea.filledRoles ?? []);
  const missingRoles = idea.lookingForRoles.filter(
    (role) => !filledRoles.has(role),
  );

  const roleMatchCount = userRoles.filter((role) =>
    missingRoles.includes(role),
  ).length;

  const { teamSizeWanted: _, ...ideaRest } = idea;

  return {
    ...ideaRest,
    teamSize: resolveTeamSize(idea),
    categoryName: category?.name,
    ownerName: getUserDisplayName(owner),
    ownerImage: owner?.image,
    ownerHandle: owner?.handle,
    memberCount: idea.memberCount ?? 0,
    interestCount: idea.interestCount ?? 0,
    reactionCounts: idea.reactionCounts ?? {},
    missingRoles,
    hasUnresolvedResources: idea.hasUnresolvedResources ?? false,
    isMember: memberIdeaIds.has(idea._id),
    isInterested: interestedIdeaIds.has(idea._id),
    isOwner: idea.ownerId === userId,
    onsiteOnly: idea.onsiteOnly,
    trendingScore: idea.trendingScore ?? 0,
    roleMatchCount,
  };
}

export const getDiscoverFeed = query({
  args: {
    mode: v.optional(
      v.union(v.literal("browse"), v.literal("findTeam")),
    ),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await getAuthenticatedUser(ctx);
    const mode = args.mode ?? "browse";
    const userRoles = user.roles ?? [];

    const [memberships, interests, dismissed] = await Promise.all([
      ctx.db
        .query("ideaMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("ideaInterest")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("dismissedIdeas")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const memberIdeaIds = new Set(memberships.map((m) => m.ideaId));
    const interestedIdeaIds = new Set(interests.map((i) => i.ideaId));
    const dismissedIdeaIds = new Set(dismissed.map((d) => d.ideaId));

    let candidates: Doc<"ideas">[] = [];

    if (mode === "findTeam") {
      const teamCandidates = await ctx.db
        .query("ideas")
        .withIndex("by_needsTeammates", (q) => q.eq("needsTeammates", true))
        .take(200);

      candidates = teamCandidates.filter(
        (idea) =>
          idea.status === "exploring" || idea.status === "forming_team",
      );
    } else {
      candidates = await ctx.db.query("ideas").take(200);
    }

    const filtered = candidates.filter((idea) => {
      if (idea.ownerId === userId) return false;
      if (memberIdeaIds.has(idea._id)) return false;
      if (interestedIdeaIds.has(idea._id)) return false;
      if (dismissedIdeaIds.has(idea._id)) return false;
      return true;
    });

    const scored = filtered.map((idea) => {
      let score = 0;

      const filledRoles = new Set(idea.filledRoles ?? []);
      const missing = idea.lookingForRoles.filter(
        (role) => !filledRoles.has(role),
      );
      const roleMatches = userRoles.filter((role) =>
        missing.includes(role),
      ).length;
      score += roleMatches * 100;

      score += (idea.trendingScore ?? 0);

      score += (idea.interestCount ?? 0) * 2;
      score += (idea.memberCount ?? 0) * 5;

      const ageHours =
        (Date.now() - idea._creationTime) / (1000 * 60 * 60);
      if (ageHours < 1) score += 50;
      else if (ageHours < 6) score += 30;
      else if (ageHours < 24) score += 15;

      return { idea, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const topIdeas = scored
      .slice(0, MAX_DISCOVER_IDEAS)
      .map((s) => s.idea);

    return await Promise.all(
      topIdeas.map((idea) =>
        enrichDiscoverIdea(
          ctx,
          idea,
          userId,
          userRoles,
          memberIdeaIds,
          interestedIdeaIds,
        ),
      ),
    );
  },
});

export const dismissIdea = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("dismissedIdeas")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (existing) return;

    await ctx.db.insert("dismissedIdeas", { ideaId, userId });
  },
});

export const undoDismissIdea = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const existing = await ctx.db
      .query("dismissedIdeas")
      .withIndex("by_idea_and_user", (q) =>
        q.eq("ideaId", ideaId).eq("userId", userId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const resetDismissedIdeas = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);

    const dismissed = await ctx.db
      .query("dismissedIdeas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(dismissed.map((d) => ctx.db.delete(d._id)));
  },
});

export const getActivityTicker = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

    const [recentMembers, recentIdeas] = await Promise.all([
      ctx.db
        .query("ideaMembers")
        .order("desc")
        .take(20),
      ctx.db
        .query("ideas")
        .order("desc")
        .take(10),
    ]);

    const recentMemberActivity = recentMembers
      .filter((m) => m._creationTime > thirtyMinutesAgo)
      .slice(0, 8);

    const recentIdeaActivity = recentIdeas
      .filter((i) => i._creationTime > thirtyMinutesAgo)
      .slice(0, 5);

    type TickerItem = {
      type: "member_joined" | "idea_created";
      userName: string;
      userImage?: string;
      ideaTitle: string;
      ideaId: Id<"ideas">;
      time: number;
    };

    const items: TickerItem[] = [];

    for (const m of recentMemberActivity) {
      const user = await ctx.db.get(m.userId);
      const idea = await ctx.db.get(m.ideaId);
      if (!user || !idea) continue;
      items.push({
        type: "member_joined",
        userName: getUserDisplayName(user, "Someone"),
        userImage: user.image,
        ideaTitle: idea.title,
        ideaId: idea._id,
        time: m._creationTime,
      });
    }

    for (const i of recentIdeaActivity) {
      const owner = await ctx.db.get(i.ownerId);
      items.push({
        type: "idea_created",
        userName: getUserDisplayName(owner, "Someone"),
        userImage: owner?.image,
        ideaTitle: i.title,
        ideaId: i._id,
        time: i._creationTime,
      });
    }

    items.sort((a, b) => b.time - a.time);

    return items.slice(0, 10);
  },
});
