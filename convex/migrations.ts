import { internal } from "./_generated/api.js";
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import { generateUniqueHandle, mergeUniqueStringArrays } from "./lib.js";

export const migrations = new Migrations<DataModel>(components.migrations);

export const backfillMemberRoles = migrations.define({
  table: "ideaMembers",
  migrateOne: async (ctx, doc) => {
    if (doc.role === undefined) return;
    await ctx.db.patch(doc._id, {
      memberRoles: mergeUniqueStringArrays(doc.memberRoles, [doc.role]),
      role: undefined,
    });
  },
});

export const backfillHandles = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    if (user.handle !== undefined) return;
    if (!user.email) return;
    const handle = await generateUniqueHandle(ctx, user.email, user._id);
    if (handle) {
      await ctx.db.patch(user._id, { handle });
    }
  },
});

export const backfillTeamSize = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    if (idea.teamSize !== undefined) return;
    const legacy = idea.teamSizeWanted ?? 3;
    const teamSize: "solo" | "small" | "medium" | "large" =
      legacy <= 1
        ? "solo"
        : legacy <= 3
          ? "small"
          : legacy <= 6
            ? "medium"
            : "large";
    await ctx.db.patch(idea._id, { teamSize, teamSizeWanted: undefined });
  },
});

export const backfillIdeaListStats = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    if (idea.memberCount !== undefined) return;

    const [members, interests, reactions, resources] = await Promise.all([
      ctx.db
        .query("ideaMembers")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .collect(),
      ctx.db
        .query("ideaInterest")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .collect(),
      ctx.db
        .query("reactions")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .collect(),
      ctx.db
        .query("resourceRequests")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .collect(),
    ]);

    const filledRoles = new Set<string>();
    for (const member of members) {
      for (const role of mergeUniqueStringArrays(
        member.memberRoles,
        member.role ? [member.role] : undefined,
      ) ?? []) {
        filledRoles.add(role);
      }
    }

    const reactionCounts: Record<string, number> = {};
    for (const reaction of reactions) {
      reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
    }

    await ctx.db.patch(idea._id, {
      memberCount: members.length,
      interestCount: interests.length,
      reactionCounts,
      filledRoles: [...filledRoles],
      resourceRequestCount: resources.length,
      hasUnresolvedResources: resources.some((resource) => !resource.resolved),
      resourceRequestSummary: resources.map((resource) => ({
        _id: resource._id,
        _creationTime: resource._creationTime,
        ideaId: resource.ideaId,
        tag: resource.tag,
        notes: resource.notes,
        resolved: resource.resolved,
      })),
    });
  },
});

export const backfillUnreadNotificationCounts = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    if (user.unreadNotificationCount !== undefined) return;

    const unreadCount = (
      await ctx.db
        .query("notifications")
        .withIndex("by_recipient_and_read", (q) =>
          q.eq("recipientId", user._id).eq("read", false),
        )
        .collect()
    ).length;

    await ctx.db.patch(user._id, { unreadNotificationCount: unreadCount });
  },
});

// Not wired to a cron or HTTP endpoint. Run manually:
//   npx convex run migrations:runAll
export const runAll = migrations.runner([
  internal.migrations.backfillMemberRoles,
  internal.migrations.backfillHandles,
  internal.migrations.backfillTeamSize,
  internal.migrations.backfillIdeaListStats,
  internal.migrations.backfillUnreadNotificationCounts,
]);
