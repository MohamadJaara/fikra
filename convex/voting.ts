import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  getAdminUser,
  getAuthenticatedUser,
  getHackathonByIdOrCurrent,
  getUserDisplayName,
  resolveTeamSize,
  STATUSES,
} from "./lib";
import type { Doc, Id } from "./_generated/dataModel";

const SETTINGS_KEY = "main";
const IDEA_STATUS_SHELVED = "shelved";
const MAX_BALLOT_IDEAS = 500;
const MAX_ROUND_VOTES = 5000;

async function getVotingSettings(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (!hackathonId) {
    return await ctx.db
      .query("votingSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
  }
  return (
    (await ctx.db
      .query("votingSettings")
      .withIndex("by_hackathon_and_key", (q) =>
        q.eq("hackathonId", hackathonId).eq("key", SETTINGS_KEY),
      )
      .unique()) ??
    (await ctx.db
      .query("votingSettings")
      .withIndex("by_hackathon_and_key", (q) =>
        q.eq("hackathonId", undefined).eq("key", SETTINGS_KEY),
      )
      .first())
  );
}

async function getExactVotingSettings(
  ctx: QueryCtx | MutationCtx,
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (!hackathonId) {
    return await ctx.db
      .query("votingSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
  }

  return await ctx.db
    .query("votingSettings")
    .withIndex("by_hackathon_and_key", (q) =>
      q.eq("hackathonId", hackathonId).eq("key", SETTINGS_KEY),
    )
    .unique();
}

async function getRoundVoteRows(
  ctx: QueryCtx,
  round: number,
  hackathonId: Id<"hackathons"> | undefined,
) {
  if (round <= 0) return [];
  return hackathonId
    ? await ctx.db
        .query("ideaVotes")
        .withIndex("by_hackathon_and_round", (q) =>
          q.eq("hackathonId", hackathonId).eq("round", round),
        )
        .take(MAX_ROUND_VOTES)
    : await ctx.db
        .query("ideaVotes")
        .withIndex("by_round", (q) => q.eq("round", round))
        .take(MAX_ROUND_VOTES);
}

async function getActiveIdeas(
  ctx: QueryCtx,
  hackathonId: Id<"hackathons"> | undefined,
) {
  const batches = await Promise.all(
    STATUSES.filter((status) => status !== IDEA_STATUS_SHELVED).map((status) =>
      hackathonId
        ? ctx.db
            .query("ideas")
            .withIndex("by_hackathon_and_status", (q) =>
              q.eq("hackathonId", hackathonId).eq("status", status),
            )
            .take(MAX_BALLOT_IDEAS)
        : ctx.db
            .query("ideas")
            .withIndex("by_status", (q) => q.eq("status", status))
            .take(MAX_BALLOT_IDEAS),
    ),
  );

  return batches
    .flat()
    .sort((a, b) => a._creationTime - b._creationTime)
    .slice(0, MAX_BALLOT_IDEAS);
}

async function buildBallotIdea(
  ctx: QueryCtx,
  idea: Doc<"ideas">,
  votedIdeaIds: Set<Id<"ideas">>,
) {
  const [owner, category] = await Promise.all([
    ctx.db.get(idea.ownerId),
    idea.categoryId ? ctx.db.get(idea.categoryId) : Promise.resolve(null),
  ]);

  return {
    _id: idea._id,
    _creationTime: idea._creationTime,
    title: idea.title,
    pitch: idea.pitch,
    status: idea.status,
    teamSize: resolveTeamSize(idea),
    ownerName: getUserDisplayName(owner),
    ownerHandle: owner?.handle,
    categoryName: category?.name,
    memberCount: idea.memberCount ?? 0,
    interestCount: idea.interestCount ?? 0,
    reactionTotal: idea.reactionTotal ?? 0,
    userVoted: votedIdeaIds.has(idea._id),
  };
}

export const status = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const settings = await getVotingSettings(ctx, hackathon?._id);
    const currentRound = settings?.currentRound ?? 0;
    const userVotes =
      currentRound > 0
        ? hackathon
          ? await ctx.db
              .query("ideaVotes")
              .withIndex("by_hackathon_and_user_and_round", (q) =>
                q
                  .eq("hackathonId", hackathon._id)
                  .eq("userId", userId)
                  .eq("round", currentRound),
              )
              .take(MAX_BALLOT_IDEAS)
          : await ctx.db
              .query("ideaVotes")
              .withIndex("by_user_and_round", (q) =>
                q.eq("userId", userId).eq("round", currentRound),
              )
              .take(MAX_BALLOT_IDEAS)
        : [];

    return {
      active: settings?.active ?? false,
      currentRound,
      startedAt: settings?.startedAt,
      endedAt: settings?.endedAt,
      viewerVoteCount: userVotes.length,
    };
  },
});

export const ballot = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const settings = await getVotingSettings(ctx, hackathon?._id);
    if (!settings?.active || settings.currentRound <= 0) return [];

    const [ideas, votes] = await Promise.all([
      getActiveIdeas(ctx, hackathon?._id),
      hackathon
        ? ctx.db
            .query("ideaVotes")
            .withIndex("by_hackathon_and_user_and_round", (q) =>
              q
                .eq("hackathonId", hackathon._id)
                .eq("userId", userId)
                .eq("round", settings.currentRound),
            )
            .take(MAX_BALLOT_IDEAS)
        : ctx.db
            .query("ideaVotes")
            .withIndex("by_user_and_round", (q) =>
              q.eq("userId", userId).eq("round", settings.currentRound),
            )
            .take(MAX_BALLOT_IDEAS),
    ]);

    const votedIdeaIds = new Set(votes.map((vote) => vote.ideaId));
    return await Promise.all(
      ideas.map((idea) => buildBallotIdea(ctx, idea, votedIdeaIds)),
    );
  },
});

export const toggleVote = mutation({
  args: { ideaId: v.id("ideas"), hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { ideaId, hackathonId }) => {
    const { userId } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const settings = await getVotingSettings(ctx, hackathon?._id);

    if (!settings?.active || settings.currentRound <= 0) {
      throw new Error("Voting is not open");
    }

    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Idea not found");
    if (
      hackathon?._id &&
      idea.hackathonId !== undefined &&
      idea.hackathonId !== hackathon._id
    ) {
      throw new Error("Idea does not belong to this hackathon");
    }
    if (idea.status === IDEA_STATUS_SHELVED) {
      throw new Error("Shelved ideas are not on the voting ballot");
    }

    const existing = hackathon
      ? await ctx.db
          .query("ideaVotes")
          .withIndex("by_hackathon_and_idea_and_user_and_round", (q) =>
            q
              .eq("hackathonId", hackathon._id)
              .eq("ideaId", ideaId)
              .eq("userId", userId)
              .eq("round", settings.currentRound),
          )
          .unique()
      : await ctx.db
          .query("ideaVotes")
          .withIndex("by_idea_and_user_and_round", (q) =>
            q
              .eq("ideaId", ideaId)
              .eq("userId", userId)
              .eq("round", settings.currentRound),
          )
          .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { voted: false };
    }

    await ctx.db.insert("ideaVotes", {
      hackathonId: hackathon?._id ?? idea.hackathonId,
      ideaId,
      userId,
      round: settings.currentRound,
      createdAt: Date.now(),
    });
    return { voted: true };
  },
});

export const adminOverview = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const settings = await getVotingSettings(ctx, hackathon?._id);
    const currentRound = settings?.currentRound ?? 0;
    const [votes, ballotIdeas] = await Promise.all([
      getRoundVoteRows(ctx, currentRound, hackathon?._id),
      getActiveIdeas(ctx, hackathon?._id),
    ]);
    const voters = new Set(votes.map((vote) => vote.userId));

    return {
      active: settings?.active ?? false,
      currentRound,
      startedAt: settings?.startedAt,
      endedAt: settings?.endedAt,
      totalVotes: votes.length,
      totalVoters: voters.size,
      ballotIdeaCount: ballotIdeas.length,
    };
  },
});

export const results = query({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const settings = await getVotingSettings(ctx, hackathon?._id);
    const currentRound = settings?.currentRound ?? 0;
    const votingEnded =
      currentRound > 0 &&
      settings?.active === false &&
      settings.endedAt !== undefined;

    if (!user.isAdmin && !votingEnded) {
      throw new Error("Results are available after voting ends");
    }

    const [votes, ideas] = await Promise.all([
      getRoundVoteRows(ctx, currentRound, hackathon?._id),
      getActiveIdeas(ctx, hackathon?._id),
    ]);

    const countsByIdea = new Map<Id<"ideas">, number>();
    for (const vote of votes) {
      countsByIdea.set(vote.ideaId, (countsByIdea.get(vote.ideaId) ?? 0) + 1);
    }

    const rows = await Promise.all(
      ideas.map(async (idea) => {
        const [owner, category] = await Promise.all([
          ctx.db.get(idea.ownerId),
          idea.categoryId ? ctx.db.get(idea.categoryId) : Promise.resolve(null),
        ]);
        return {
          _id: idea._id,
          title: idea.title,
          pitch: idea.pitch,
          status: idea.status,
          ownerName: getUserDisplayName(owner),
          categoryName: category?.name,
          voteCount: countsByIdea.get(idea._id) ?? 0,
          interestCount: idea.interestCount ?? 0,
          memberCount: idea.memberCount ?? 0,
        };
      }),
    );

    return rows.sort(
      (a, b) =>
        b.voteCount - a.voteCount ||
        b.interestCount - a.interestCount ||
        a.title.localeCompare(b.title),
    );
  },
});

export const start = mutation({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const existing = await getExactVotingSettings(ctx, hackathon?._id);
    const now = Date.now();

    if (!existing) {
      await ctx.db.insert("votingSettings", {
        hackathonId: hackathon?._id,
        key: SETTINGS_KEY,
        active: true,
        currentRound: 1,
        startedAt: now,
        updatedBy: userId,
        updatedAt: now,
      });
      return { currentRound: 1 };
    }

    const nextRound = existing.active
      ? existing.currentRound
      : existing.currentRound + 1;
    await ctx.db.patch(existing._id, {
      active: true,
      currentRound: nextRound,
      startedAt: existing.active ? existing.startedAt : now,
      endedAt: undefined,
      updatedBy: userId,
      updatedAt: now,
    });

    return { currentRound: nextRound };
  },
});

export const stop = mutation({
  args: { hackathonId: v.optional(v.id("hackathons")) },
  handler: async (ctx, { hackathonId }) => {
    const { userId } = await getAdminUser(ctx);
    const hackathon = await getHackathonByIdOrCurrent(ctx, hackathonId);
    const now = Date.now();
    const existing = await getExactVotingSettings(ctx, hackathon?._id);
    if (!existing) {
      const inherited = await getVotingSettings(ctx, hackathon?._id);
      if (hackathon && inherited?.active) {
        await ctx.db.insert("votingSettings", {
          hackathonId: hackathon._id,
          key: SETTINGS_KEY,
          active: false,
          currentRound: inherited.currentRound,
          startedAt: inherited.startedAt,
          endedAt: now,
          updatedBy: userId,
          updatedAt: now,
        });
      }
      return { active: false };
    }

    await ctx.db.patch(existing._id, {
      active: false,
      endedAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    return { active: false };
  },
});
