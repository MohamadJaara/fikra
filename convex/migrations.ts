import { internal } from "./_generated/api.js";
import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import {
  generateUniqueHandle,
  isEffectiveIdeaMember,
  mergeUniqueStringArrays,
  PLATFORM_SETTING_KEY,
} from "./lib.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";

export const migrations = new Migrations<DataModel>(components.migrations);

async function getMigrationActor(ctx: MutationCtx) {
  const users = await ctx.db.query("users").take(1000);
  const admin = users.find((user) => user.isAdmin);
  const actor = admin ?? users[0];
  if (!actor) {
    throw new Error("Cannot create initial hackathon without at least one user");
  }
  return actor._id;
}

async function getOrCreateInitialHackathon(
  ctx: MutationCtx,
): Promise<Id<"hackathons">> {
  const platformSetting = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTING_KEY))
    .unique();
  if (platformSetting?.currentHackathonId) {
    const current = await ctx.db.get(platformSetting.currentHackathonId);
    if (current) return current._id;
  }

  const existing = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q) => q.eq("slug", "legacy-hackathon"))
    .first();
  const actorId = await getMigrationActor(ctx);
  const now = Date.now();
  if (existing) {
    if (!platformSetting) {
      await ctx.db.insert("platformSettings", {
        key: PLATFORM_SETTING_KEY,
        currentHackathonId: existing._id,
        updatedBy: actorId,
        updatedAt: now,
      });
    } else if (!platformSetting.currentHackathonId) {
      await ctx.db.patch(platformSetting._id, {
        currentHackathonId: existing._id,
        updatedBy: actorId,
        updatedAt: now,
      });
    }
    return existing._id;
  }

  const eventSetting = await ctx.db
    .query("eventSettings")
    .withIndex("by_key", (q) => q.eq("key", "main"))
    .first();
  const startsAt = eventSetting?.startsAt ?? now;
  const status =
    eventSetting?.completedAt !== undefined
      ? "completed"
      : eventSetting?.active === false
        ? "upcoming"
        : "active";
  const hackathonId = await ctx.db.insert("hackathons", {
    slug: "legacy-hackathon",
    title: eventSetting?.title ?? "Legacy Hackathon",
    startsAt,
    endsAt: eventSetting?.endsAt,
    timezone: eventSetting?.timezone ?? "UTC",
    location: eventSetting?.location,
    note: eventSetting?.note,
    status,
    completedAt: eventSetting?.completedAt,
    completedBy: eventSetting?.completedBy,
    createdBy: actorId,
    updatedBy: actorId,
    updatedAt: now,
  });

  if (platformSetting) {
    await ctx.db.patch(platformSetting._id, {
      currentHackathonId: hackathonId,
      updatedBy: actorId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("platformSettings", {
      key: PLATFORM_SETTING_KEY,
      currentHackathonId: hackathonId,
      updatedBy: actorId,
      updatedAt: now,
    });
  }

  return hackathonId;
}

async function initialHackathonIdForMigration(
  ctx: MutationCtx,
) {
  return await getOrCreateInitialHackathon(ctx);
}

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

    const effectiveMembers = members.filter((member) =>
      isEffectiveIdeaMember(member, idea),
    );

    const filledRoles = new Set<string>();
    for (const member of effectiveMembers) {
      for (const role of mergeUniqueStringArrays(
        member.memberRoles,
        member.role ? [member.role] : undefined,
      ) ?? []) {
        filledRoles.add(role);
      }
    }

    const reactionCounts: Record<string, number> = {};
    let reactionTotal = 0;
    for (const reaction of reactions) {
      reactionCounts[reaction.type] = (reactionCounts[reaction.type] || 0) + 1;
      reactionTotal++;
    }

    const needsTeammates =
      idea.status !== "full" &&
      idea.lookingForRoles.some((role) => !filledRoles.has(role));

    await ctx.db.patch(idea._id, {
      memberCount: effectiveMembers.length,
      interestCount: interests.length,
      reactionCounts,
      reactionTotal,
      filledRoles: [...filledRoles],
      resourceRequestCount: resources.length,
      hasUnresolvedResources: resources.some((resource) => !resource.resolved),
      needsTeammates,
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

export const backfillIdeaListDerivedStats = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    if (idea.reactionTotal !== undefined && idea.needsTeammates !== undefined) {
      return;
    }

    let reactionTotal = idea.reactionTotal;
    if (reactionTotal === undefined) {
      if (idea.reactionCounts !== undefined) {
        reactionTotal = Object.values(idea.reactionCounts).reduce(
          (total, count) => total + count,
          0,
        );
      } else {
        reactionTotal = (
          await ctx.db
            .query("reactions")
            .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
            .collect()
        ).length;
      }
    }

    let filledRoles = idea.filledRoles;
    if (filledRoles === undefined && idea.needsTeammates === undefined) {
      const members = await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
        .collect();
      const effectiveMembers = members.filter((member) =>
        isEffectiveIdeaMember(member, idea),
      );
      const filled = new Set<string>();
      for (const member of effectiveMembers) {
        for (const role of mergeUniqueStringArrays(
          member.memberRoles,
          member.role ? [member.role] : undefined,
        ) ?? []) {
          filled.add(role);
        }
      }
      filledRoles = [...filled];
    }

    const filledRoleSet = new Set(filledRoles ?? []);
    const needsTeammates =
      idea.needsTeammates ??
      (idea.status !== "full" &&
        idea.lookingForRoles.some((role) => !filledRoleSet.has(role)));

    await ctx.db.patch(idea._id, {
      reactionTotal,
      needsTeammates,
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

export const backfillOwnerMemberSeparation = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    const members = await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q) => q.eq("ideaId", idea._id))
      .collect();
    const effectiveMembers = members.filter((member) =>
      isEffectiveIdeaMember(member, idea),
    );

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
      idea.status !== "full" &&
      idea.lookingForRoles.some((role) => !filledRoles.has(role));

    await ctx.db.patch(idea._id, {
      memberCount: effectiveMembers.length,
      filledRoles: [...filledRoles],
      needsTeammates,
    });
  },
});

export const backfillHackathonParticipants = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    const hackathonId = await initialHackathonIdForMigration(ctx);
    const existing = await ctx.db
      .query("hackathonParticipants")
      .withIndex("by_hackathon_and_user", (q) =>
        q.eq("hackathonId", hackathonId).eq("userId", user._id),
      )
      .unique();
    if (existing) return;

    const now = Date.now();
    await ctx.db.insert("hackathonParticipants", {
      hackathonId,
      userId: user._id,
      roles: user.roles,
      participationMode:
        user.participationMode === "onsite" ||
        user.participationMode === "remote"
          ? user.participationMode
          : undefined,
      onboardingComplete: user.onboardingComplete,
      registeredAt: user._creationTime,
      updatedAt: now,
    });
  },
});

export const backfillIdeaHackathonIds = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    if (idea.hackathonId !== undefined) return;
    await ctx.db.patch(idea._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillCategoryHackathonIds = migrations.define({
  table: "categories",
  migrateOne: async (ctx, category) => {
    if (category.hackathonId !== undefined) return;
    await ctx.db.patch(category._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillResourceHackathonIds = migrations.define({
  table: "resources",
  migrateOne: async (ctx, resource) => {
    if (resource.hackathonId !== undefined) return;
    await ctx.db.patch(resource._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillRoleHackathonIds = migrations.define({
  table: "roles",
  migrateOne: async (ctx, role) => {
    if (role.hackathonId !== undefined) return;
    await ctx.db.patch(role._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillRoomHackathonIds = migrations.define({
  table: "rooms",
  migrateOne: async (ctx, room) => {
    if (room.hackathonId !== undefined) return;
    await ctx.db.patch(room._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillAnnouncementHackathonIds = migrations.define({
  table: "announcements",
  migrateOne: async (ctx, announcement) => {
    if (announcement.hackathonId !== undefined) return;
    await ctx.db.patch(announcement._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillIdeaSubmissionSettingsHackathonIds = migrations.define({
  table: "ideaSubmissionSettings",
  migrateOne: async (ctx, setting) => {
    if (setting.hackathonId !== undefined) return;
    await ctx.db.patch(setting._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

export const backfillVotingSettingsHackathonIds = migrations.define({
  table: "votingSettings",
  migrateOne: async (ctx, setting) => {
    if (setting.hackathonId !== undefined) return;
    await ctx.db.patch(setting._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
  },
});

async function hackathonIdForIdea(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
): Promise<Id<"hackathons">> {
  const idea = await ctx.db.get(ideaId);
  return idea?.hackathonId ?? (await initialHackathonIdForMigration(ctx));
}

export const backfillIdeaMemberHackathonIds = migrations.define({
  table: "ideaMembers",
  migrateOne: async (ctx, member) => {
    if (member.hackathonId !== undefined) return;
    await ctx.db.patch(member._id, {
      hackathonId: await hackathonIdForIdea(ctx, member.ideaId),
    });
  },
});

export const backfillIdeaInterestHackathonIds = migrations.define({
  table: "ideaInterest",
  migrateOne: async (ctx, interest) => {
    if (interest.hackathonId !== undefined) return;
    await ctx.db.patch(interest._id, {
      hackathonId: await hackathonIdForIdea(ctx, interest.ideaId),
    });
  },
});

export const backfillCommentHackathonIds = migrations.define({
  table: "comments",
  migrateOne: async (ctx, comment) => {
    if (comment.hackathonId !== undefined) return;
    await ctx.db.patch(comment._id, {
      hackathonId: await hackathonIdForIdea(ctx, comment.ideaId),
    });
  },
});

export const backfillReactionHackathonIds = migrations.define({
  table: "reactions",
  migrateOne: async (ctx, reaction) => {
    if (reaction.hackathonId !== undefined) return;
    await ctx.db.patch(reaction._id, {
      hackathonId: await hackathonIdForIdea(ctx, reaction.ideaId),
    });
  },
});

export const backfillResourceRequestHackathonIds = migrations.define({
  table: "resourceRequests",
  migrateOne: async (ctx, request) => {
    if (request.hackathonId !== undefined) return;
    await ctx.db.patch(request._id, {
      hackathonId: await hackathonIdForIdea(ctx, request.ideaId),
    });
  },
});

export const backfillOwnershipTransferHackathonIds = migrations.define({
  table: "ownershipTransferRequests",
  migrateOne: async (ctx, request) => {
    if (request.hackathonId !== undefined) return;
    await ctx.db.patch(request._id, {
      hackathonId: await hackathonIdForIdea(ctx, request.ideaId),
    });
  },
});

export const backfillRelatedIdeaHackathonIds = migrations.define({
  table: "relatedIdeas",
  migrateOne: async (ctx, relation) => {
    if (relation.hackathonId !== undefined) return;
    await ctx.db.patch(relation._id, {
      hackathonId: await hackathonIdForIdea(ctx, relation.ideaIdA),
    });
  },
});

export const backfillDismissedIdeaHackathonIds = migrations.define({
  table: "dismissedIdeas",
  migrateOne: async (ctx, dismissed) => {
    if (dismissed.hackathonId !== undefined) return;
    await ctx.db.patch(dismissed._id, {
      hackathonId: await hackathonIdForIdea(ctx, dismissed.ideaId),
    });
  },
});

export const backfillIdeaBookmarkHackathonIds = migrations.define({
  table: "ideaBookmarks",
  migrateOne: async (ctx, bookmark) => {
    if (bookmark.hackathonId !== undefined) return;
    await ctx.db.patch(bookmark._id, {
      hackathonId: await hackathonIdForIdea(ctx, bookmark.ideaId),
    });
  },
});

export const backfillIdeaVoteHackathonIds = migrations.define({
  table: "ideaVotes",
  migrateOne: async (ctx, vote) => {
    if (vote.hackathonId !== undefined) return;
    await ctx.db.patch(vote._id, {
      hackathonId: await hackathonIdForIdea(ctx, vote.ideaId),
    });
  },
});

export const backfillNotificationHackathonIds = migrations.define({
  table: "notifications",
  migrateOne: async (ctx, notification) => {
    if (notification.hackathonId !== undefined) return;
    await ctx.db.patch(notification._id, {
      hackathonId: await hackathonIdForIdea(ctx, notification.ideaId),
    });
  },
});

export const backfillDismissedAnnouncementHackathonIds = migrations.define({
  table: "dismissedAnnouncements",
  migrateOne: async (ctx, dismissed) => {
    if (dismissed.hackathonId !== undefined) return;
    const announcement = await ctx.db.get(dismissed.announcementId);
    await ctx.db.patch(dismissed._id, {
      hackathonId:
        announcement?.hackathonId ?? (await initialHackathonIdForMigration(ctx)),
    });
  },
});

// Not wired to a cron or HTTP endpoint. Run manually:
//   npx convex run migrations:runAll
export const runAll = migrations.runner([
  internal.migrations.backfillMemberRoles,
  internal.migrations.backfillHandles,
  internal.migrations.backfillTeamSize,
  internal.migrations.backfillIdeaListStats,
  internal.migrations.backfillIdeaListDerivedStats,
  internal.migrations.backfillOwnerMemberSeparation,
  internal.migrations.backfillUnreadNotificationCounts,
  internal.migrations.backfillHackathonParticipants,
  internal.migrations.backfillIdeaHackathonIds,
  internal.migrations.backfillCategoryHackathonIds,
  internal.migrations.backfillResourceHackathonIds,
  internal.migrations.backfillRoleHackathonIds,
  internal.migrations.backfillRoomHackathonIds,
  internal.migrations.backfillAnnouncementHackathonIds,
  internal.migrations.backfillIdeaSubmissionSettingsHackathonIds,
  internal.migrations.backfillVotingSettingsHackathonIds,
  internal.migrations.backfillIdeaMemberHackathonIds,
  internal.migrations.backfillIdeaInterestHackathonIds,
  internal.migrations.backfillCommentHackathonIds,
  internal.migrations.backfillReactionHackathonIds,
  internal.migrations.backfillResourceRequestHackathonIds,
  internal.migrations.backfillOwnershipTransferHackathonIds,
  internal.migrations.backfillRelatedIdeaHackathonIds,
  internal.migrations.backfillDismissedIdeaHackathonIds,
  internal.migrations.backfillIdeaBookmarkHackathonIds,
  internal.migrations.backfillIdeaVoteHackathonIds,
  internal.migrations.backfillNotificationHackathonIds,
  internal.migrations.backfillDismissedAnnouncementHackathonIds,
]);
