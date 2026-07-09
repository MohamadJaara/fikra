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
import { internalQuery } from "./_generated/server.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { v } from "convex/values";

export const migrations = new Migrations<DataModel>(components.migrations);

function invalidScopeBlocker(documentId: string, reason: string): never {
  throw new Error(
    `Hackathon scope migration blocked for ${documentId}: ${reason}. ` +
      "Inspect the record, then explicitly run migrations:runInvalidScopeCleanup before retrying the scope migration.",
  );
}

function archivedTargetBlocker(hackathonId: Id<"hackathons">): never {
  throw new Error(
    `Hackathon scope migration target ${hackathonId} is archived. ` +
      "Restore the pinned scope migration target to a non-archived state before retrying.",
  );
}

function missingPinnedTargetBlocker(hackathonId: Id<"hackathons">): never {
  throw new Error(
    `Pinned hackathon scope migration target ${hackathonId} no longer exists. ` +
      "Restore that hackathon or explicitly repair platformSettings.scopeMigrationHackathonId before retrying.",
  );
}

function duplicateParticipantBlocker(
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
): never {
  throw new Error(
    `Hackathon participant migration blocked: duplicate rows exist for hackathon ${hackathonId} and user ${userId}. ` +
      "Inspect and resolve the ambiguity manually, then retry the normal scope migration runner.",
  );
}

async function getMigrationActor(ctx: MutationCtx) {
  const users = await ctx.db.query("users").take(1000);
  const admin = users.find((user) => user.isAdmin);
  const actor = admin ?? users[0];
  if (!actor) {
    throw new Error(
      "Cannot create initial hackathon without at least one user",
    );
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
  if (platformSetting?.scopeMigrationHackathonId) {
    const pinned = await ctx.db.get(platformSetting.scopeMigrationHackathonId);
    if (!pinned) {
      missingPinnedTargetBlocker(platformSetting.scopeMigrationHackathonId);
    }
    if (pinned.status === "archived") archivedTargetBlocker(pinned._id);
    return pinned._id;
  }
  if (platformSetting?.currentHackathonId) {
    const current = await ctx.db.get(platformSetting.currentHackathonId);
    if (current?.status === "archived") archivedTargetBlocker(current._id);
    if (current) {
      await ctx.db.patch(platformSetting._id, {
        scopeMigrationHackathonId: current._id,
      });
      return current._id;
    }
  }

  const existing = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q) => q.eq("slug", "legacy-hackathon"))
    .first();
  const actorId = await getMigrationActor(ctx);
  const now = Date.now();
  if (existing) {
    if (existing.status === "archived") archivedTargetBlocker(existing._id);
    if (!platformSetting) {
      await ctx.db.insert("platformSettings", {
        key: PLATFORM_SETTING_KEY,
        currentHackathonId: existing._id,
        scopeMigrationHackathonId: existing._id,
        updatedBy: actorId,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(platformSetting._id, {
        currentHackathonId: existing._id,
        scopeMigrationHackathonId: existing._id,
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
      scopeMigrationHackathonId: hackathonId,
      updatedBy: actorId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("platformSettings", {
      key: PLATFORM_SETTING_KEY,
      currentHackathonId: hackathonId,
      scopeMigrationHackathonId: hackathonId,
      updatedBy: actorId,
      updatedAt: now,
    });
  }

  return hackathonId;
}

async function initialHackathonIdForMigration(ctx: MutationCtx) {
  return await getOrCreateInitialHackathon(ctx);
}

type ScopedRootId =
  | Id<"ideas">
  | Id<"categories">
  | Id<"resources">
  | Id<"roles">
  | Id<"rooms">
  | Id<"announcements">
  | Id<"ideaSubmissionSettings">
  | Id<"votingSettings">;

type IdeaChildId =
  | Id<"ideaMembers">
  | Id<"ideaInterest">
  | Id<"comments">
  | Id<"reactions">
  | Id<"resourceRequests">
  | Id<"ownershipTransferRequests">
  | Id<"dismissedIdeas">
  | Id<"ideaBookmarks">
  | Id<"ideaVotes">;

/**
 * Legacy root documents without a scope belong to the initial hackathon.
 * A document pointing at a deleted hackathon is genuinely orphaned and is
 * removed instead of being silently reassigned to a different event.
 */
export async function repairScopedRootHackathonId(
  ctx: MutationCtx,
  document: {
    _id: ScopedRootId;
    hackathonId?: Id<"hackathons">;
  },
) {
  if (document.hackathonId === undefined) {
    await ctx.db.patch(document._id, {
      hackathonId: await initialHackathonIdForMigration(ctx),
    });
    return "patched" as const;
  }

  if (!(await ctx.db.get(document.hackathonId))) {
    invalidScopeBlocker(
      document._id,
      `referenced hackathon ${document.hackathonId} does not exist`,
    );
  }

  return "unchanged" as const;
}

async function canonicalHackathonIdForIdea(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
): Promise<Id<"hackathons"> | null> {
  const idea = await ctx.db.get(ideaId);
  if (!idea) return null;

  if (idea.hackathonId !== undefined) {
    return (await ctx.db.get(idea.hackathonId)) ? idea.hackathonId : null;
  }

  const hackathonId = await initialHackathonIdForMigration(ctx);
  await ctx.db.patch(idea._id, { hackathonId });
  return hackathonId;
}

/**
 * Child scope is always canonicalized from a valid idea. Missing ideas or
 * ideas pointing at deleted hackathons make the child an orphan.
 */
export async function repairIdeaChildHackathonId(
  ctx: MutationCtx,
  document: {
    _id: IdeaChildId;
    ideaId: Id<"ideas">;
    hackathonId?: Id<"hackathons">;
  },
) {
  const hackathonId = await canonicalHackathonIdForIdea(ctx, document.ideaId);
  if (!hackathonId) {
    invalidScopeBlocker(
      document._id,
      `parent idea ${document.ideaId} or its hackathon does not exist`,
    );
  }

  if (document.hackathonId !== hackathonId) {
    await ctx.db.patch(document._id, { hackathonId });
    return "patched" as const;
  }

  return "unchanged" as const;
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

export async function backfillInitialHackathonParticipant(
  ctx: MutationCtx,
  user: {
    _id: Id<"users">;
    _creationTime: number;
    roles?: string[];
    participationMode?: string;
    onboardingComplete?: boolean;
  },
) {
  const hackathonId = await initialHackathonIdForMigration(ctx);
  const existing = await assertUniqueHackathonParticipant(
    ctx,
    hackathonId,
    user._id,
  );
  if (existing) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("hackathonParticipants", {
    hackathonId,
    userId: user._id,
    roles: user.roles,
    participationMode:
      user.participationMode === "onsite" || user.participationMode === "remote"
        ? user.participationMode
        : undefined,
    onboardingComplete: user.onboardingComplete,
    registeredAt: user._creationTime,
    updatedAt: now,
  });
}

export async function assertUniqueHackathonParticipant(
  ctx: MutationCtx | QueryCtx,
  hackathonId: Id<"hackathons">,
  userId: Id<"users">,
) {
  const matches = await ctx.db
    .query("hackathonParticipants")
    .withIndex("by_hackathon_and_user", (q) =>
      q.eq("hackathonId", hackathonId).eq("userId", userId),
    )
    .take(2);
  if (matches.length > 1) duplicateParticipantBlocker(hackathonId, userId);
  return matches[0] ?? null;
}

export const backfillHackathonParticipants = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    await backfillInitialHackathonParticipant(ctx, user);
  },
});

// Exhaustive, non-destructive integrity gate. This intentionally traverses
// every participant row so duplicates in non-current hackathons also block the
// successful completion required before the narrow-schema deploy.
export const verifyHackathonParticipantUniqueness = migrations.define({
  table: "hackathonParticipants",
  migrateOne: async (ctx, participant) => {
    await assertUniqueHackathonParticipant(
      ctx,
      participant.hackathonId,
      participant.userId,
    );
  },
});

export const backfillIdeaHackathonIds = migrations.define({
  table: "ideas",
  migrateOne: async (ctx, idea) => {
    await repairScopedRootHackathonId(ctx, idea);
  },
});

export const backfillCategoryHackathonIds = migrations.define({
  table: "categories",
  migrateOne: async (ctx, category) => {
    await repairScopedRootHackathonId(ctx, category);
  },
});

export const backfillResourceHackathonIds = migrations.define({
  table: "resources",
  migrateOne: async (ctx, resource) => {
    await repairScopedRootHackathonId(ctx, resource);
  },
});

export const backfillRoleHackathonIds = migrations.define({
  table: "roles",
  migrateOne: async (ctx, role) => {
    await repairScopedRootHackathonId(ctx, role);
  },
});

export const backfillRoomHackathonIds = migrations.define({
  table: "rooms",
  migrateOne: async (ctx, room) => {
    await repairScopedRootHackathonId(ctx, room);
  },
});

export const backfillAnnouncementHackathonIds = migrations.define({
  table: "announcements",
  migrateOne: async (ctx, announcement) => {
    await repairScopedRootHackathonId(ctx, announcement);
  },
});

export const backfillIdeaSubmissionSettingsHackathonIds = migrations.define({
  table: "ideaSubmissionSettings",
  migrateOne: async (ctx, setting) => {
    await repairScopedRootHackathonId(ctx, setting);
  },
});

export const backfillVotingSettingsHackathonIds = migrations.define({
  table: "votingSettings",
  migrateOne: async (ctx, setting) => {
    await repairScopedRootHackathonId(ctx, setting);
  },
});

export const backfillIdeaMemberHackathonIds = migrations.define({
  table: "ideaMembers",
  migrateOne: async (ctx, member) => {
    await repairIdeaChildHackathonId(ctx, member);
  },
});

export const backfillIdeaInterestHackathonIds = migrations.define({
  table: "ideaInterest",
  migrateOne: async (ctx, interest) => {
    await repairIdeaChildHackathonId(ctx, interest);
  },
});

export const backfillCommentHackathonIds = migrations.define({
  table: "comments",
  migrateOne: async (ctx, comment) => {
    await repairIdeaChildHackathonId(ctx, comment);
  },
});

export const backfillReactionHackathonIds = migrations.define({
  table: "reactions",
  migrateOne: async (ctx, reaction) => {
    await repairIdeaChildHackathonId(ctx, reaction);
  },
});

export const backfillResourceRequestHackathonIds = migrations.define({
  table: "resourceRequests",
  migrateOne: async (ctx, request) => {
    await repairIdeaChildHackathonId(ctx, request);
  },
});

export const backfillOwnershipTransferHackathonIds = migrations.define({
  table: "ownershipTransferRequests",
  migrateOne: async (ctx, request) => {
    await repairIdeaChildHackathonId(ctx, request);
  },
});

export async function repairRelatedIdeaHackathonId(
  ctx: MutationCtx,
  relation: {
    _id: Id<"relatedIdeas">;
    ideaIdA: Id<"ideas">;
    ideaIdB: Id<"ideas">;
    hackathonId?: Id<"hackathons">;
  },
) {
  const hackathonIdA = await canonicalHackathonIdForIdea(ctx, relation.ideaIdA);
  const hackathonIdB = await canonicalHackathonIdForIdea(ctx, relation.ideaIdB);
  if (!hackathonIdA || !hackathonIdB || hackathonIdA !== hackathonIdB) {
    invalidScopeBlocker(
      relation._id,
      "related ideas are missing, reference missing hackathons, or belong to different hackathons",
    );
  }
  if (relation.hackathonId !== hackathonIdA) {
    await ctx.db.patch(relation._id, { hackathonId: hackathonIdA });
    return "patched" as const;
  }
  return "unchanged" as const;
}

export const backfillRelatedIdeaHackathonIds = migrations.define({
  table: "relatedIdeas",
  migrateOne: async (ctx, relation) => {
    await repairRelatedIdeaHackathonId(ctx, relation);
  },
});

export const backfillDismissedIdeaHackathonIds = migrations.define({
  table: "dismissedIdeas",
  migrateOne: async (ctx, dismissed) => {
    await repairIdeaChildHackathonId(ctx, dismissed);
  },
});

export const backfillIdeaBookmarkHackathonIds = migrations.define({
  table: "ideaBookmarks",
  migrateOne: async (ctx, bookmark) => {
    await repairIdeaChildHackathonId(ctx, bookmark);
  },
});

export const backfillIdeaVoteHackathonIds = migrations.define({
  table: "ideaVotes",
  migrateOne: async (ctx, vote) => {
    await repairIdeaChildHackathonId(ctx, vote);
  },
});

export const backfillNotificationHackathonIds = migrations.define({
  table: "notifications",
  migrateOne: async (ctx, notification) => {
    const hackathonId = await canonicalHackathonIdForIdea(
      ctx,
      notification.ideaId,
    );
    if (!hackathonId) {
      invalidScopeBlocker(
        notification._id,
        `parent idea ${notification.ideaId} or its hackathon does not exist`,
      );
    }
    if (notification.hackathonId !== hackathonId) {
      await ctx.db.patch(notification._id, { hackathonId });
    }
  },
});

export const backfillDismissedAnnouncementHackathonIds = migrations.define({
  table: "dismissedAnnouncements",
  migrateOne: async (ctx, dismissed) => {
    const announcement = await ctx.db.get(dismissed.announcementId);
    if (!announcement) {
      invalidScopeBlocker(
        dismissed._id,
        `parent announcement ${dismissed.announcementId} does not exist`,
      );
    }

    let hackathonId = announcement.hackathonId;
    if (hackathonId === undefined) {
      hackathonId = await initialHackathonIdForMigration(ctx);
      await ctx.db.patch(announcement._id, { hackathonId });
    } else if (!(await ctx.db.get(hackathonId))) {
      invalidScopeBlocker(
        dismissed._id,
        `announcement hackathon ${hackathonId} does not exist`,
      );
    }

    if (dismissed.hackathonId !== hackathonId) {
      await ctx.db.patch(dismissed._id, { hackathonId });
    }
  },
});

/**
 * Destructive helpers below are intentionally excluded from all repair runners.
 * They are used only by the explicitly irreversible cleanup runner.
 */
export async function cleanupInvalidScopedRoot(
  ctx: MutationCtx,
  document: {
    _id: ScopedRootId;
    hackathonId?: Id<"hackathons">;
  },
) {
  if (
    document.hackathonId !== undefined &&
    !(await ctx.db.get(document.hackathonId))
  ) {
    await ctx.db.delete(document._id);
    return "deleted" as const;
  }
  return "unchanged" as const;
}

export async function cleanupInvalidIdeaChild(
  ctx: MutationCtx,
  document: {
    _id: IdeaChildId;
    ideaId: Id<"ideas">;
  },
) {
  const idea = await ctx.db.get(document.ideaId);
  const invalid =
    !idea ||
    (idea.hackathonId !== undefined && !(await ctx.db.get(idea.hackathonId)));
  if (invalid) {
    await ctx.db.delete(document._id);
    return "deleted" as const;
  }
  return "unchanged" as const;
}

export async function cleanupInvalidRelatedIdea(
  ctx: MutationCtx,
  relation: {
    _id: Id<"relatedIdeas">;
    ideaIdA: Id<"ideas">;
    ideaIdB: Id<"ideas">;
  },
) {
  const [ideaA, ideaB] = await Promise.all([
    ctx.db.get(relation.ideaIdA),
    ctx.db.get(relation.ideaIdB),
  ]);
  const invalid =
    !ideaA ||
    !ideaB ||
    (ideaA.hackathonId !== undefined &&
      !(await ctx.db.get(ideaA.hackathonId))) ||
    (ideaB.hackathonId !== undefined &&
      !(await ctx.db.get(ideaB.hackathonId))) ||
    (ideaA.hackathonId !== undefined &&
      ideaB.hackathonId !== undefined &&
      ideaA.hackathonId !== ideaB.hackathonId);
  if (invalid) {
    await ctx.db.delete(relation._id);
    return "deleted" as const;
  }
  return "unchanged" as const;
}

export async function cleanupInvalidNotification(
  ctx: MutationCtx,
  notification: {
    _id: Id<"notifications">;
    ideaId: Id<"ideas">;
    recipientId: Id<"users">;
    read: boolean;
  },
) {
  const idea = await ctx.db.get(notification.ideaId);
  const invalid =
    !idea ||
    (idea.hackathonId !== undefined && !(await ctx.db.get(idea.hackathonId)));
  if (!invalid) return "unchanged" as const;

  if (!notification.read) {
    const recipient = await ctx.db.get(notification.recipientId);
    if (typeof recipient?.unreadNotificationCount === "number") {
      await ctx.db.patch(recipient._id, {
        unreadNotificationCount: Math.max(
          0,
          recipient.unreadNotificationCount - 1,
        ),
      });
    }
  }
  await ctx.db.delete(notification._id);
  return "deleted" as const;
}

export async function cleanupInvalidDismissedAnnouncement(
  ctx: MutationCtx,
  dismissed: {
    _id: Id<"dismissedAnnouncements">;
    announcementId: Id<"announcements">;
  },
) {
  const announcement = await ctx.db.get(dismissed.announcementId);
  const invalid =
    !announcement ||
    (announcement.hackathonId !== undefined &&
      !(await ctx.db.get(announcement.hackathonId)));
  if (invalid) {
    await ctx.db.delete(dismissed._id);
    return "deleted" as const;
  }
  return "unchanged" as const;
}

export const cleanupInvalidIdeaScopes = migrations.define({
  table: "ideas",
  batchSize: 50,
  migrateOne: async (ctx, idea) => {
    await cleanupInvalidScopedRoot(ctx, idea);
  },
});
export const cleanupInvalidCategoryScopes = migrations.define({
  table: "categories",
  batchSize: 50,
  migrateOne: async (ctx, category) => {
    await cleanupInvalidScopedRoot(ctx, category);
  },
});
export const cleanupInvalidResourceScopes = migrations.define({
  table: "resources",
  batchSize: 50,
  migrateOne: async (ctx, resource) => {
    await cleanupInvalidScopedRoot(ctx, resource);
  },
});
export const cleanupInvalidRoleScopes = migrations.define({
  table: "roles",
  batchSize: 50,
  migrateOne: async (ctx, role) => {
    await cleanupInvalidScopedRoot(ctx, role);
  },
});
export const cleanupInvalidRoomScopes = migrations.define({
  table: "rooms",
  batchSize: 50,
  migrateOne: async (ctx, room) => {
    await cleanupInvalidScopedRoot(ctx, room);
  },
});
export const cleanupInvalidAnnouncementScopes = migrations.define({
  table: "announcements",
  batchSize: 50,
  migrateOne: async (ctx, announcement) => {
    await cleanupInvalidScopedRoot(ctx, announcement);
  },
});
export const cleanupInvalidSubmissionSettingScopes = migrations.define({
  table: "ideaSubmissionSettings",
  batchSize: 50,
  migrateOne: async (ctx, setting) => {
    await cleanupInvalidScopedRoot(ctx, setting);
  },
});
export const cleanupInvalidVotingSettingScopes = migrations.define({
  table: "votingSettings",
  batchSize: 50,
  migrateOne: async (ctx, setting) => {
    await cleanupInvalidScopedRoot(ctx, setting);
  },
});
export const cleanupInvalidMemberScopes = migrations.define({
  table: "ideaMembers",
  batchSize: 50,
  migrateOne: async (ctx, member) => {
    await cleanupInvalidIdeaChild(ctx, member);
  },
});
export const cleanupInvalidInterestScopes = migrations.define({
  table: "ideaInterest",
  batchSize: 50,
  migrateOne: async (ctx, interest) => {
    await cleanupInvalidIdeaChild(ctx, interest);
  },
});
export const cleanupInvalidCommentScopes = migrations.define({
  table: "comments",
  batchSize: 50,
  migrateOne: async (ctx, comment) => {
    await cleanupInvalidIdeaChild(ctx, comment);
  },
});
export const cleanupInvalidReactionScopes = migrations.define({
  table: "reactions",
  batchSize: 50,
  migrateOne: async (ctx, reaction) => {
    await cleanupInvalidIdeaChild(ctx, reaction);
  },
});
export const cleanupInvalidResourceRequestScopes = migrations.define({
  table: "resourceRequests",
  batchSize: 50,
  migrateOne: async (ctx, request) => {
    await cleanupInvalidIdeaChild(ctx, request);
  },
});
export const cleanupInvalidOwnershipTransferScopes = migrations.define({
  table: "ownershipTransferRequests",
  batchSize: 50,
  migrateOne: async (ctx, request) => {
    await cleanupInvalidIdeaChild(ctx, request);
  },
});
export const cleanupInvalidDismissedIdeaScopes = migrations.define({
  table: "dismissedIdeas",
  batchSize: 50,
  migrateOne: async (ctx, dismissed) => {
    await cleanupInvalidIdeaChild(ctx, dismissed);
  },
});
export const cleanupInvalidBookmarkScopes = migrations.define({
  table: "ideaBookmarks",
  batchSize: 50,
  migrateOne: async (ctx, bookmark) => {
    await cleanupInvalidIdeaChild(ctx, bookmark);
  },
});
export const cleanupInvalidVoteScopes = migrations.define({
  table: "ideaVotes",
  batchSize: 50,
  migrateOne: async (ctx, vote) => {
    await cleanupInvalidIdeaChild(ctx, vote);
  },
});
export const cleanupInvalidRelatedIdeaScopes = migrations.define({
  table: "relatedIdeas",
  batchSize: 50,
  migrateOne: async (ctx, relation) => {
    await cleanupInvalidRelatedIdea(ctx, relation);
  },
});
export const cleanupInvalidNotificationScopes = migrations.define({
  table: "notifications",
  batchSize: 50,
  migrateOne: async (ctx, notification) => {
    await cleanupInvalidNotification(ctx, notification);
  },
});
export const cleanupInvalidDismissedAnnouncementScopes = migrations.define({
  table: "dismissedAnnouncements",
  batchSize: 50,
  migrateOne: async (ctx, dismissed) => {
    await cleanupInvalidDismissedAnnouncement(ctx, dismissed);
  },
});

type ScopeVerificationIssue = {
  table: string;
  documentId: string;
  reason: string;
  actualHackathonId: string | null;
  expectedHackathonId: string | null;
};

function boundedSummary<T extends { _id: string }>(rows: T[], limit: number) {
  return {
    sampleCount: Math.min(rows.length, limit),
    hasMore: rows.length > limit,
    sampleIds: rows.slice(0, limit).map((row) => row._id),
  };
}

function pushVerificationIssue(
  issues: ScopeVerificationIssue[],
  issue: ScopeVerificationIssue,
) {
  if (issues.length < 50) issues.push(issue);
}

async function verifyRootBatch(
  ctx: QueryCtx,
  table: string,
  documents: Array<{
    _id: string;
    hackathonId?: Id<"hackathons">;
  }>,
  issues: ScopeVerificationIssue[],
) {
  for (const document of documents) {
    if (
      document.hackathonId !== undefined &&
      !(await ctx.db.get(document.hackathonId))
    ) {
      pushVerificationIssue(issues, {
        table,
        documentId: document._id,
        reason: "orphan_hackathon",
        actualHackathonId: document.hackathonId,
        expectedHackathonId: null,
      });
    }
  }
}

async function verifyIdeaChildBatch(
  ctx: QueryCtx,
  table: string,
  documents: Array<{
    _id: string;
    ideaId: Id<"ideas">;
    hackathonId?: Id<"hackathons">;
  }>,
  issues: ScopeVerificationIssue[],
) {
  for (const document of documents) {
    const idea = await ctx.db.get(document.ideaId);
    if (!idea) {
      pushVerificationIssue(issues, {
        table,
        documentId: document._id,
        reason: "orphan_idea",
        actualHackathonId: document.hackathonId ?? null,
        expectedHackathonId: null,
      });
      continue;
    }
    if (idea.hackathonId === undefined) {
      pushVerificationIssue(issues, {
        table,
        documentId: document._id,
        reason: "parent_unscoped",
        actualHackathonId: document.hackathonId ?? null,
        expectedHackathonId: null,
      });
      continue;
    }
    if (!(await ctx.db.get(idea.hackathonId))) {
      pushVerificationIssue(issues, {
        table,
        documentId: document._id,
        reason: "parent_hackathon_missing",
        actualHackathonId: document.hackathonId ?? null,
        expectedHackathonId: idea.hackathonId,
      });
      continue;
    }
    if (document.hackathonId !== idea.hackathonId) {
      pushVerificationIssue(issues, {
        table,
        documentId: document._id,
        reason:
          document.hackathonId === undefined
            ? "child_unscoped"
            : "scope_mismatch",
        actualHackathonId: document.hackathonId ?? null,
        expectedHackathonId: idea.hackathonId,
      });
    }
  }
}

/**
 * Bounded diagnostic report for the narrow-schema deploy. `hasMore` and
 * `scanTruncatedByTable` are count indicators, not exact totals. This query
 * never declares the deployment ready: successful completion of every job in
 * runHackathonScope remains the mandatory exhaustive gate.
 */
export const verifyHackathonScope = internalQuery({
  args: { sampleLimit: v.optional(v.number()) },
  handler: async (ctx, { sampleLimit }) => {
    const limit = Math.max(1, Math.min(10, Math.floor(sampleLimit ?? 5)));
    const take = limit + 1;

    const [
      unscopedIdeas,
      unscopedCategories,
      unscopedResources,
      unscopedRoles,
      unscopedRooms,
      unscopedIdeaMembers,
      unscopedIdeaInterest,
      unscopedComments,
      unscopedReactions,
      unscopedResourceRequests,
      unscopedOwnershipTransfers,
      unscopedRelatedIdeas,
      unscopedDismissedIdeas,
      unscopedBookmarks,
      unscopedVotingSettings,
      unscopedVotes,
      unscopedNotifications,
      unscopedAnnouncements,
      unscopedSubmissionSettings,
      unscopedDismissedAnnouncements,
      ideas,
      categories,
      resources,
      roles,
      rooms,
      hackathonParticipants,
      ideaMembers,
      ideaInterest,
      comments,
      reactions,
      resourceRequests,
      ownershipTransfers,
      relatedIdeas,
      dismissedIdeas,
      bookmarks,
      votingSettings,
      votes,
      notifications,
      announcements,
      submissionSettings,
      dismissedAnnouncements,
      legacyEventSettings,
    ] = await Promise.all([
      ctx.db
        .query("ideas")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("categories")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("resources")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("roles")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("rooms")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ideaMembers")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ideaInterest")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("comments")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("reactions")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("resourceRequests")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ownershipTransferRequests")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("relatedIdeas")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("dismissedIdeas")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ideaBookmarks")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("votingSettings")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ideaVotes")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("notifications")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("announcements")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("ideaSubmissionSettings")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db
        .query("dismissedAnnouncements")
        .withIndex("by_hackathon", (q) => q.eq("hackathonId", undefined))
        .take(take),
      ctx.db.query("ideas").take(take),
      ctx.db.query("categories").take(take),
      ctx.db.query("resources").take(take),
      ctx.db.query("roles").take(take),
      ctx.db.query("rooms").take(take),
      ctx.db.query("hackathonParticipants").take(take),
      ctx.db.query("ideaMembers").take(take),
      ctx.db.query("ideaInterest").take(take),
      ctx.db.query("comments").take(take),
      ctx.db.query("reactions").take(take),
      ctx.db.query("resourceRequests").take(take),
      ctx.db.query("ownershipTransferRequests").take(take),
      ctx.db.query("relatedIdeas").take(take),
      ctx.db.query("dismissedIdeas").take(take),
      ctx.db.query("ideaBookmarks").take(take),
      ctx.db.query("votingSettings").take(take),
      ctx.db.query("ideaVotes").take(take),
      ctx.db.query("notifications").take(take),
      ctx.db.query("announcements").take(take),
      ctx.db.query("ideaSubmissionSettings").take(take),
      ctx.db.query("dismissedAnnouncements").take(take),
      ctx.db
        .query("eventSettings")
        .withIndex("by_key", (q) => q.eq("key", "main"))
        .take(take),
    ]);

    const unscoped = {
      ideas: boundedSummary(unscopedIdeas, limit),
      categories: boundedSummary(unscopedCategories, limit),
      resources: boundedSummary(unscopedResources, limit),
      roles: boundedSummary(unscopedRoles, limit),
      rooms: boundedSummary(unscopedRooms, limit),
      ideaMembers: boundedSummary(unscopedIdeaMembers, limit),
      ideaInterest: boundedSummary(unscopedIdeaInterest, limit),
      comments: boundedSummary(unscopedComments, limit),
      reactions: boundedSummary(unscopedReactions, limit),
      resourceRequests: boundedSummary(unscopedResourceRequests, limit),
      ownershipTransferRequests: boundedSummary(
        unscopedOwnershipTransfers,
        limit,
      ),
      relatedIdeas: boundedSummary(unscopedRelatedIdeas, limit),
      dismissedIdeas: boundedSummary(unscopedDismissedIdeas, limit),
      ideaBookmarks: boundedSummary(unscopedBookmarks, limit),
      votingSettings: boundedSummary(unscopedVotingSettings, limit),
      ideaVotes: boundedSummary(unscopedVotes, limit),
      notifications: boundedSummary(unscopedNotifications, limit),
      announcements: boundedSummary(unscopedAnnouncements, limit),
      ideaSubmissionSettings: boundedSummary(unscopedSubmissionSettings, limit),
      dismissedAnnouncements: boundedSummary(
        unscopedDismissedAnnouncements,
        limit,
      ),
    };

    const issues: ScopeVerificationIssue[] = [];
    for (const [table, documents] of [
      ["ideas", ideas],
      ["categories", categories],
      ["resources", resources],
      ["roles", roles],
      ["rooms", rooms],
      ["votingSettings", votingSettings],
      ["announcements", announcements],
      ["ideaSubmissionSettings", submissionSettings],
    ] as const) {
      await verifyRootBatch(ctx, table, documents.slice(0, limit), issues);
    }
    for (const [table, documents] of [
      ["ideaMembers", ideaMembers],
      ["ideaInterest", ideaInterest],
      ["comments", comments],
      ["reactions", reactions],
      ["resourceRequests", resourceRequests],
      ["ownershipTransferRequests", ownershipTransfers],
      ["dismissedIdeas", dismissedIdeas],
      ["ideaBookmarks", bookmarks],
      ["ideaVotes", votes],
      ["notifications", notifications],
    ] as const) {
      await verifyIdeaChildBatch(ctx, table, documents.slice(0, limit), issues);
    }

    for (const participant of hackathonParticipants.slice(0, limit)) {
      const matches = await ctx.db
        .query("hackathonParticipants")
        .withIndex("by_hackathon_and_user", (q) =>
          q
            .eq("hackathonId", participant.hackathonId)
            .eq("userId", participant.userId),
        )
        .take(2);
      if (matches.length > 1) {
        pushVerificationIssue(issues, {
          table: "hackathonParticipants",
          documentId: participant._id,
          reason: "duplicate_participant",
          actualHackathonId: participant.hackathonId,
          expectedHackathonId: participant.hackathonId,
        });
      }
    }

    for (const relation of relatedIdeas.slice(0, limit)) {
      const [ideaA, ideaB] = await Promise.all([
        ctx.db.get(relation.ideaIdA),
        ctx.db.get(relation.ideaIdB),
      ]);
      const valid =
        ideaA?.hackathonId !== undefined &&
        ideaB?.hackathonId !== undefined &&
        ideaA.hackathonId === ideaB.hackathonId &&
        relation.hackathonId === ideaA.hackathonId &&
        (await ctx.db.get(ideaA.hackathonId)) !== null;
      if (!valid) {
        pushVerificationIssue(issues, {
          table: "relatedIdeas",
          documentId: relation._id,
          reason: !ideaA || !ideaB ? "orphan_idea" : "cross_event_relation",
          actualHackathonId: relation.hackathonId ?? null,
          expectedHackathonId:
            ideaA?.hackathonId === ideaB?.hackathonId
              ? (ideaA?.hackathonId ?? null)
              : null,
        });
      }
    }

    for (const dismissed of dismissedAnnouncements.slice(0, limit)) {
      const announcement = await ctx.db.get(dismissed.announcementId);
      const valid =
        announcement?.hackathonId !== undefined &&
        dismissed.hackathonId === announcement.hackathonId &&
        (await ctx.db.get(announcement.hackathonId)) !== null;
      if (!valid) {
        pushVerificationIssue(issues, {
          table: "dismissedAnnouncements",
          documentId: dismissed._id,
          reason: announcement ? "scope_mismatch" : "orphan_announcement",
          actualHackathonId: dismissed.hackathonId ?? null,
          expectedHackathonId: announcement?.hackathonId ?? null,
        });
      }
    }

    const scannedBatches = {
      ideas,
      categories,
      resources,
      roles,
      rooms,
      hackathonParticipants,
      ideaMembers,
      ideaInterest,
      comments,
      reactions,
      resourceRequests,
      ownershipTransferRequests: ownershipTransfers,
      relatedIdeas,
      dismissedIdeas,
      ideaBookmarks: bookmarks,
      votingSettings,
      ideaVotes: votes,
      notifications,
      announcements,
      ideaSubmissionSettings: submissionSettings,
      dismissedAnnouncements,
    };
    const scanTruncatedByTable = Object.fromEntries(
      Object.entries(scannedBatches).map(([table, rows]) => [
        table,
        rows.length > limit,
      ]),
    );
    const hasObservedUnscoped = Object.values(unscoped).some(
      (summary) => summary.sampleCount > 0,
    );

    const integrityScanTruncated =
      Object.values(scanTruncatedByTable).some(Boolean);
    const noObservedBlockers =
      !hasObservedUnscoped &&
      issues.length === 0 &&
      legacyEventSettings.length === 0 &&
      !integrityScanTruncated;

    return {
      sampleLimit: limit,
      exhaustive: !integrityScanTruncated,
      runnerCompletionRequired: true,
      readyForNarrowSchema: false,
      readinessReason:
        "This query is diagnostic only. Complete migrations:runHackathonScope and verify every migrations-component job succeeded before narrowing the schema.",
      unscoped,
      integrityIssueSamples: issues,
      integrityIssueSampleCount: issues.length,
      scanTruncatedByTable,
      legacyEventSettings: boundedSummary(legacyEventSettings, limit),
      noObservedBlockers,
    };
  },
});

/**
 * Irreversible pre-narrow cleanup. Keep this separate from all normal scope
 * runners so operators can verify the canonical hackathon and retain the
 * legacy settings through the rollback window.
 */
export async function cleanupLegacyEventSetting(
  ctx: MutationCtx,
  eventSettingId: Id<"eventSettings">,
) {
  await getOrCreateInitialHackathon(ctx);
  if (await ctx.db.get(eventSettingId)) {
    await ctx.db.delete(eventSettingId);
    return "deleted" as const;
  }
  return "unchanged" as const;
}

export const deleteLegacyEventSettings = migrations.define({
  table: "eventSettings",
  migrateOne: async (ctx, eventSetting) => {
    await cleanupLegacyEventSetting(ctx, eventSetting._id);
  },
});

// Generic single-migration runner. Pass, for example:
//   {"fn":"migrations:backfillIdeaHackathonIds","dryRun":true}
export const runScopeOne = migrations.runner();

// Scope-only runner ordered so roots are repaired before their children.
export const runHackathonScope = migrations.runner([
  internal.migrations.backfillIdeaHackathonIds,
  internal.migrations.backfillCategoryHackathonIds,
  internal.migrations.backfillResourceHackathonIds,
  internal.migrations.backfillRoleHackathonIds,
  internal.migrations.backfillRoomHackathonIds,
  internal.migrations.backfillAnnouncementHackathonIds,
  internal.migrations.backfillIdeaSubmissionSettingsHackathonIds,
  internal.migrations.backfillVotingSettingsHackathonIds,
  internal.migrations.backfillHackathonParticipants,
  internal.migrations.verifyHackathonParticipantUniqueness,
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

// Explicitly irreversible cleanup for corrupt foreign keys and cross-event
// relations. Never run this until the repair runner has stopped on a blocker,
// the affected records have been inspected, and a dry run has been reviewed.
export const runInvalidScopeCleanup = migrations.runner([
  internal.migrations.cleanupInvalidIdeaScopes,
  internal.migrations.cleanupInvalidCategoryScopes,
  internal.migrations.cleanupInvalidResourceScopes,
  internal.migrations.cleanupInvalidRoleScopes,
  internal.migrations.cleanupInvalidRoomScopes,
  internal.migrations.cleanupInvalidAnnouncementScopes,
  internal.migrations.cleanupInvalidSubmissionSettingScopes,
  internal.migrations.cleanupInvalidVotingSettingScopes,
  internal.migrations.cleanupInvalidMemberScopes,
  internal.migrations.cleanupInvalidInterestScopes,
  internal.migrations.cleanupInvalidCommentScopes,
  internal.migrations.cleanupInvalidReactionScopes,
  internal.migrations.cleanupInvalidResourceRequestScopes,
  internal.migrations.cleanupInvalidOwnershipTransferScopes,
  internal.migrations.cleanupInvalidDismissedIdeaScopes,
  internal.migrations.cleanupInvalidBookmarkScopes,
  internal.migrations.cleanupInvalidVoteScopes,
  internal.migrations.cleanupInvalidRelatedIdeaScopes,
  internal.migrations.cleanupInvalidNotificationScopes,
  internal.migrations.cleanupInvalidDismissedAnnouncementScopes,
]);

// Irreversible pre-narrow step. Intentionally excluded from runHackathonScope
// and runAll so it only runs after verification and the rollback window.
export const runLegacyEventSettingsCleanup = migrations.runner(
  internal.migrations.deleteLegacyEventSettings,
);

// Not wired to a cron or HTTP endpoint. Run manually only after a dry run.
export const runAll = migrations.runner([
  internal.migrations.backfillMemberRoles,
  internal.migrations.backfillHandles,
  internal.migrations.backfillTeamSize,
  internal.migrations.backfillIdeaListStats,
  internal.migrations.backfillIdeaListDerivedStats,
  internal.migrations.backfillOwnerMemberSeparation,
  internal.migrations.backfillUnreadNotificationCounts,
  internal.migrations.backfillHackathonParticipants,
  internal.migrations.verifyHackathonParticipantUniqueness,
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
