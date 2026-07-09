import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { getCurrentHackathon } from "./lib";

export const IDEA_DELETION_BATCH_SIZE = 32;
export const IDEA_DELETION_STALE_AFTER_MS = 5 * 60 * 1000;
const IDEA_DELETION_REAPER_BATCH_SIZE = 8;

type DeletionPhase = Doc<"ideaDeletionJobs">["phase"];
type ActiveDeletionPhase = Exclude<DeletionPhase, "complete">;

const FIRST_PHASE: ActiveDeletionPhase = "ideaMembers";

const NEXT_PHASE: Record<ActiveDeletionPhase, DeletionPhase> = {
  ideaMembers: "ideaInterest",
  ideaInterest: "comments",
  comments: "reactions",
  reactions: "resourceRequests",
  resourceRequests: "ownershipTransferRequests",
  ownershipTransferRequests: "relatedIdeasAsA",
  relatedIdeasAsA: "relatedIdeasAsB",
  relatedIdeasAsB: "dismissedIdeas",
  dismissedIdeas: "ideaBookmarks",
  ideaBookmarks: "ideaVotes",
  ideaVotes: "notifications",
  notifications: "complete",
};

async function deleteRows<TableName extends TableNames>(
  ctx: MutationCtx,
  rows: Array<Doc<TableName>>,
) {
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

async function deleteNotificationBatch(ctx: MutationCtx, ideaId: Id<"ideas">) {
  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .take(IDEA_DELETION_BATCH_SIZE);

  const unreadByRecipient = new Map<Id<"users">, number>();
  for (const notification of notifications) {
    if (!notification.read) {
      unreadByRecipient.set(
        notification.recipientId,
        (unreadByRecipient.get(notification.recipientId) ?? 0) + 1,
      );
    }
  }

  for (const notification of notifications) {
    await ctx.db.delete(notification._id);
  }

  for (const [recipientId, removedUnread] of unreadByRecipient) {
    const recipient = await ctx.db.get(recipientId);
    if (typeof recipient?.unreadNotificationCount === "number") {
      await ctx.db.patch(recipientId, {
        unreadNotificationCount: Math.max(
          0,
          recipient.unreadNotificationCount - removedUnread,
        ),
      });
    }
  }

  return notifications.length;
}

async function deletePhaseBatch(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
  phase: ActiveDeletionPhase,
): Promise<number> {
  switch (phase) {
    case "ideaMembers":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("ideaMembers")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "ideaInterest":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("ideaInterest")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "comments":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("comments")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "reactions":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("reactions")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "resourceRequests":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("resourceRequests")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "ownershipTransferRequests":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("ownershipTransferRequests")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "relatedIdeasAsA":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("relatedIdeas")
          .withIndex("by_ideaA", (q) => q.eq("ideaIdA", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "relatedIdeasAsB":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("relatedIdeas")
          .withIndex("by_ideaB", (q) => q.eq("ideaIdB", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "dismissedIdeas":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("dismissedIdeas")
          .withIndex("by_idea_and_user", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "ideaBookmarks":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("ideaBookmarks")
          .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "ideaVotes":
      return await deleteRows(
        ctx,
        await ctx.db
          .query("ideaVotes")
          .withIndex("by_idea_and_round", (q) => q.eq("ideaId", ideaId))
          .take(IDEA_DELETION_BATCH_SIZE),
      );
    case "notifications":
      return await deleteNotificationBatch(ctx, ideaId);
  }
}

async function scheduleDeletionBatch(
  ctx: MutationCtx,
  jobId: Id<"ideaDeletionJobs">,
) {
  const _scheduledId: Id<"_scheduled_functions"> = await ctx.scheduler.runAfter(
    0,
    internal.ideaLifecycle.processDeletionJob,
    { jobId },
  );
}

export const processDeletionJob = internalMutation({
  args: { jobId: v.id("ideaDeletionJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status === "completed" || job.phase === "complete") {
      return null;
    }

    const deletedInBatch = await deletePhaseBatch(ctx, job.ideaId, job.phase);
    const now = Date.now();
    const deletedCount = job.deletedCount + deletedInBatch;
    const phaseDeletedCount = job.phaseDeletedCount + deletedInBatch;
    const batchCount = job.batchCount + 1;

    if (deletedInBatch === IDEA_DELETION_BATCH_SIZE) {
      await ctx.db.patch(jobId, {
        status: "running",
        deletedCount,
        phaseDeletedCount,
        batchCount,
        updatedAt: now,
      });
      await scheduleDeletionBatch(ctx, jobId);
      return null;
    }

    const nextPhase = NEXT_PHASE[job.phase];
    if (nextPhase === "complete") {
      await ctx.db.patch(jobId, {
        phase: "complete",
        status: "completed",
        deletedCount,
        phaseDeletedCount,
        batchCount,
        updatedAt: now,
        completedAt: now,
      });
      return null;
    }

    await ctx.db.patch(jobId, {
      phase: nextPhase,
      status: "running",
      deletedCount,
      phaseDeletedCount: 0,
      batchCount,
      updatedAt: now,
    });
    await scheduleDeletionBatch(ctx, jobId);
    return null;
  },
});

export const resumeStaleDeletionJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const staleBefore = Date.now() - IDEA_DELETION_STALE_AFTER_MS;
    const jobs = (
      await Promise.all(
        (["pending", "running"] as const).map((status) =>
          ctx.db
            .query("ideaDeletionJobs")
            .withIndex("by_status_and_updatedAt", (q) =>
              q.eq("status", status).lt("updatedAt", staleBefore),
            )
            .take(IDEA_DELETION_REAPER_BATCH_SIZE),
        ),
      )
    ).flat();
    const resumedAt = Date.now();

    for (const job of jobs) {
      await ctx.db.patch(job._id, { updatedAt: resumedAt });
      await scheduleDeletionBatch(ctx, job._id);
    }

    return jobs.length;
  },
});

/**
 * Makes an idea disappear synchronously, then schedules bounded cleanup of all
 * idea-owned documents. Authorization and hackathon checks belong to callers.
 */
export async function deleteIdeaAndReferences(
  ctx: MutationCtx,
  ideaId: Id<"ideas">,
) {
  const existingJob = await ctx.db
    .query("ideaDeletionJobs")
    .withIndex("by_idea", (q) => q.eq("ideaId", ideaId))
    .unique();
  const idea = await ctx.db.get(ideaId);

  if (existingJob) {
    if (idea) await ctx.db.delete(ideaId);
    if (existingJob.status !== "completed") {
      await scheduleDeletionBatch(ctx, existingJob._id);
    }
    return existingJob._id;
  }

  if (!idea) return null;

  const hackathonId = idea.hackathonId ?? (await getCurrentHackathon(ctx))?._id;
  if (!hackathonId) {
    throw new Error(
      "Cannot delete an unscoped idea without a configured hackathon",
    );
  }

  const now = Date.now();
  const jobId = await ctx.db.insert("ideaDeletionJobs", {
    ideaId,
    hackathonId,
    phase: FIRST_PHASE,
    status: "pending",
    deletedCount: 0,
    phaseDeletedCount: 0,
    batchCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.delete(ideaId);
  await scheduleDeletionBatch(ctx, jobId);
  return jobId;
}
