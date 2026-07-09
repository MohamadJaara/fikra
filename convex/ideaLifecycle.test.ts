/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, initTest, insertUser, seedCategory } from "./testHelpers.test";

afterEach(() => {
  vi.useRealTimers();
});

async function seedLifecycleFixture(t: ReturnType<typeof initTest>) {
  const ownerEmail = "lifecycle-owner@test.com";
  const adminEmail = "lifecycle-admin@test.com";
  const recipientEmail = "lifecycle-recipient@test.com";
  const ownerId = await insertUser(t, { email: ownerEmail });
  const adminId = await insertUser(t, { email: adminEmail, isAdmin: true });
  const recipientId = await insertUser(t, {
    email: recipientEmail,
    unreadNotificationCount: 2,
  });
  const categoryId = await seedCategory(t);

  const ids = await t.run(async (ctx: any) => {
    const category = await ctx.db.get(categoryId);
    const hackathonId = category!.hackathonId as Id<"hackathons">;
    const ideaFields = {
      hackathonId,
      categoryId,
      pitch: "A focused lifecycle test",
      problem: "Orphaned records",
      targetAudience: "Maintainers",
      skillsNeeded: [],
      status: "exploring",
      lookingForRoles: [],
      ownerId,
    };
    const ideaId = (await ctx.db.insert("ideas", {
      ...ideaFields,
      title: "Idea to delete",
    })) as Id<"ideas">;
    const relatedIdeaId = (await ctx.db.insert("ideas", {
      ...ideaFields,
      title: "Related survivor",
    })) as Id<"ideas">;
    const unrelatedIdeaId = (await ctx.db.insert("ideas", {
      ...ideaFields,
      title: "Unrelated survivor",
    })) as Id<"ideas">;

    await ctx.db.insert("ideaMembers", {
      hackathonId,
      ideaId,
      userId: recipientId,
      memberRoles: ["developer"],
    });
    await ctx.db.insert("ideaInterest", {
      hackathonId,
      ideaId,
      userId: recipientId,
    });
    const commentId = await ctx.db.insert("comments", {
      hackathonId,
      ideaId,
      userId: recipientId,
      content: "Root comment",
    });
    await ctx.db.insert("comments", {
      hackathonId,
      ideaId,
      userId: ownerId,
      content: "Reply",
      parentId: commentId,
    });
    await ctx.db.insert("reactions", {
      hackathonId,
      ideaId,
      userId: recipientId,
      type: "like",
    });
    await ctx.db.insert("resourceRequests", {
      hackathonId,
      ideaId,
      tag: "workspace",
      resolved: false,
    });
    await ctx.db.insert("ownershipTransferRequests", {
      hackathonId,
      ideaId,
      requesterId: ownerId,
      recipientId,
      leaveAfterTransfer: false,
      status: "pending",
    });
    await ctx.db.insert("relatedIdeas", {
      hackathonId,
      ideaIdA: ideaId,
      ideaIdB: relatedIdeaId,
      markedByUserId: ownerId,
      relationType: "related",
    });
    await ctx.db.insert("relatedIdeas", {
      hackathonId,
      ideaIdA: relatedIdeaId,
      ideaIdB: ideaId,
      markedByUserId: ownerId,
      relationType: "duplicate",
    });
    await ctx.db.insert("dismissedIdeas", {
      hackathonId,
      ideaId,
      userId: recipientId,
    });
    await ctx.db.insert("ideaBookmarks", {
      hackathonId,
      ideaId,
      userId: recipientId,
    });
    await ctx.db.insert("ideaVotes", {
      hackathonId,
      ideaId,
      userId: recipientId,
      round: 1,
      createdAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      hackathonId,
      recipientId,
      actorId: ownerId,
      ideaId,
      type: "comment_added",
      read: false,
      commentId,
    });
    await ctx.db.insert("notifications", {
      hackathonId,
      recipientId,
      actorId: ownerId,
      ideaId,
      type: "reaction_added",
      read: true,
    });
    const survivingNotificationId = await ctx.db.insert("notifications", {
      hackathonId,
      recipientId,
      actorId: ownerId,
      ideaId: unrelatedIdeaId,
      type: "comment_added",
      read: false,
    });

    return {
      ideaId,
      relatedIdeaId,
      unrelatedIdeaId,
      survivingNotificationId,
    };
  });

  return {
    ...ids,
    ownerId,
    ownerEmail,
    adminId,
    adminEmail,
    recipientId,
  };
}

async function expectIdeaLifecycleDeleted(
  t: ReturnType<typeof initTest>,
  fixture: Awaited<ReturnType<typeof seedLifecycleFixture>>,
) {
  const result = await t.run(async (ctx: any) => {
    const relationsAsA = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaA", (q: any) => q.eq("ideaIdA", fixture.ideaId))
      .collect();
    const relationsAsB = await ctx.db
      .query("relatedIdeas")
      .withIndex("by_ideaB", (q: any) => q.eq("ideaIdB", fixture.ideaId))
      .collect();

    return {
      idea: await ctx.db.get(fixture.ideaId),
      members: await ctx.db
        .query("ideaMembers")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      interests: await ctx.db
        .query("ideaInterest")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      comments: await ctx.db
        .query("comments")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      reactions: await ctx.db
        .query("reactions")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      resources: await ctx.db
        .query("resourceRequests")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      transfers: await ctx.db
        .query("ownershipTransferRequests")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      relations: [...relationsAsA, ...relationsAsB],
      dismissals: await ctx.db
        .query("dismissedIdeas")
        .withIndex("by_idea_and_user", (q: any) =>
          q.eq("ideaId", fixture.ideaId),
        )
        .collect(),
      bookmarks: await ctx.db
        .query("ideaBookmarks")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      votes: await ctx.db
        .query("ideaVotes")
        .withIndex("by_idea_and_round", (q: any) =>
          q.eq("ideaId", fixture.ideaId),
        )
        .collect(),
      notifications: await ctx.db
        .query("notifications")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .collect(),
      recipient: await ctx.db.get(fixture.recipientId),
      relatedIdea: await ctx.db.get(fixture.relatedIdeaId),
      unrelatedIdea: await ctx.db.get(fixture.unrelatedIdeaId),
      survivingNotification: await ctx.db.get(fixture.survivingNotificationId),
      job: await ctx.db
        .query("ideaDeletionJobs")
        .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
        .unique(),
    };
  });

  expect(result.idea).toBeNull();
  for (const rows of [
    result.members,
    result.interests,
    result.comments,
    result.reactions,
    result.resources,
    result.transfers,
    result.relations,
    result.dismissals,
    result.bookmarks,
    result.votes,
    result.notifications,
  ]) {
    expect(rows).toHaveLength(0);
  }
  expect(result.recipient?.unreadNotificationCount).toBe(1);
  expect(result.relatedIdea).not.toBeNull();
  expect(result.unrelatedIdea).not.toBeNull();
  expect(result.survivingNotification).not.toBeNull();
  expect(result.job).toMatchObject({
    phase: "complete",
    status: "completed",
  });
  expect(result.job?.completedAt).toEqual(expect.any(Number));
}

async function getDeletionJob(
  t: ReturnType<typeof initTest>,
  ideaId: Id<"ideas">,
) {
  return await t.run(async (ctx: any) => {
    return await ctx.db
      .query("ideaDeletionJobs")
      .withIndex("by_idea", (q: any) => q.eq("ideaId", ideaId))
      .unique();
  });
}

async function expectImmediateTombstone(
  t: ReturnType<typeof initTest>,
  fixture: Awaited<ReturnType<typeof seedLifecycleFixture>>,
) {
  const immediate = await t.run(async (ctx: any) => ({
    idea: await ctx.db.get(fixture.ideaId),
    members: await ctx.db
      .query("ideaMembers")
      .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
      .take(1),
    job: await ctx.db
      .query("ideaDeletionJobs")
      .withIndex("by_idea", (q: any) => q.eq("ideaId", fixture.ideaId))
      .unique(),
  }));

  expect(immediate.idea).toBeNull();
  expect(immediate.members).toHaveLength(1);
  expect(immediate.job).toMatchObject({
    phase: "ideaMembers",
    status: "pending",
    deletedCount: 0,
    batchCount: 0,
  });
  return immediate.job!;
}

async function drainScheduledFunctions(t: ReturnType<typeof initTest>) {
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

describe("idea lifecycle deletion", () => {
  test("owner deletion removes every idea-owned record", async () => {
    vi.useFakeTimers();
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);

    await asUser(t, fixture.ownerId, fixture.ownerEmail).mutation(
      api.ideas.remove,
      { ideaId: fixture.ideaId },
    );

    await expectImmediateTombstone(t, fixture);
    await drainScheduledFunctions(t);
    await expectIdeaLifecycleDeleted(t, fixture);
  });

  test("admin deletion uses the same complete lifecycle cascade", async () => {
    vi.useFakeTimers();
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);

    await asUser(t, fixture.adminId, fixture.adminEmail).mutation(
      api.admin.deleteIdea,
      { ideaId: fixture.ideaId },
    );

    await expectImmediateTombstone(t, fixture);
    await drainScheduledFunctions(t);
    await expectIdeaLifecycleDeleted(t, fixture);
  });

  test("high-cardinality cleanup resumes across batches and completion is idempotent", async () => {
    vi.useFakeTimers();
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);
    const extraComments = 101;
    const extraUnreadNotifications = 70;

    await t.run(async (ctx: any) => {
      const idea = await ctx.db.get(fixture.ideaId);
      for (let index = 0; index < extraComments; index += 1) {
        await ctx.db.insert("comments", {
          hackathonId: idea!.hackathonId,
          ideaId: fixture.ideaId,
          userId: fixture.recipientId,
          content: `Bulk comment ${index}`,
        });
      }
      for (let index = 0; index < extraUnreadNotifications; index += 1) {
        await ctx.db.insert("notifications", {
          hackathonId: idea!.hackathonId,
          recipientId: fixture.recipientId,
          actorId: fixture.ownerId,
          ideaId: fixture.ideaId,
          type: "comment_added",
          read: false,
        });
      }
      // Notification mutations maintain this counter, so deletion can apply a
      // bounded delta without scanning the recipient's global notification set.
      await ctx.db.patch(fixture.recipientId, {
        unreadNotificationCount: 2 + extraUnreadNotifications,
      });
    });

    await asUser(t, fixture.ownerId, fixture.ownerEmail).mutation(
      api.ideas.remove,
      { ideaId: fixture.ideaId },
    );
    const initialJob = await expectImmediateTombstone(t, fixture);

    await t.run(async (ctx: any) => {
      await ctx.db.patch(initialJob._id, { updatedAt: 0 });
    });
    expect(
      await t.mutation(internal.ideaLifecycle.resumeStaleDeletionJobs, {}),
    ).toBe(1);

    // Manual invocations simulate an interrupted worker being resumed while the
    // original scheduled invocation is still pending. All processors are safe
    // to repeat because they read the persisted phase on every run.
    await t.mutation(internal.ideaLifecycle.processDeletionJob, {
      jobId: initialJob._id,
    });
    const resumedJob = await getDeletionJob(t, fixture.ideaId);
    expect(resumedJob).toMatchObject({
      phase: "ideaInterest",
      status: "running",
      deletedCount: 1,
      batchCount: 1,
    });

    await drainScheduledFunctions(t);
    await expectIdeaLifecycleDeleted(t, fixture);

    const completedJob = await getDeletionJob(t, fixture.ideaId);
    expect(completedJob?.deletedCount).toBe(
      14 + extraComments + extraUnreadNotifications,
    );
    expect(completedJob?.batchCount).toBeGreaterThan(12);

    await t.mutation(internal.ideaLifecycle.processDeletionJob, {
      jobId: completedJob!._id,
    });
    await t.mutation(internal.ideaLifecycle.processDeletionJob, {
      jobId: completedJob!._id,
    });
    expect(await getDeletionJob(t, fixture.ideaId)).toEqual(completedJob);
  });

  test("legacy unscoped ideas use a concrete current scope and remain intact without one", async () => {
    vi.useFakeTimers();
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);
    const { legacyIdeaId, currentHackathonId } = await t.run(
      async (ctx: any) => {
        const setting = await ctx.db
          .query("platformSettings")
          .withIndex("by_key", (q: any) => q.eq("key", "main"))
          .unique();
        const legacyIdeaId = await ctx.db.insert("ideas", {
          title: "Legacy unscoped idea",
          pitch: "Needs a deletion job scope",
          problem: "Legacy data",
          targetAudience: "Maintainers",
          skillsNeeded: [],
          status: "exploring",
          lookingForRoles: [],
          ownerId: fixture.ownerId,
        });
        return {
          legacyIdeaId,
          currentHackathonId: setting!.currentHackathonId,
        };
      },
    );

    await asUser(t, fixture.adminId, fixture.adminEmail).mutation(
      api.admin.deleteIdea,
      { ideaId: legacyIdeaId },
    );
    const scopedJob = await getDeletionJob(t, legacyIdeaId);
    expect(scopedJob?.hackathonId).toBe(currentHackathonId);
    expect(
      await t.run(async (ctx: any) => ctx.db.get(legacyIdeaId)),
    ).toBeNull();
    await drainScheduledFunctions(t);
    expect((await getDeletionJob(t, legacyIdeaId))?.status).toBe("completed");

    const withoutEvent = initTest();
    const adminEmail = "unscoped-no-event-admin@test.com";
    const adminId = await insertUser(withoutEvent, {
      email: adminEmail,
      isAdmin: true,
    });
    const orphanedIdeaId = (await withoutEvent.run(async (ctx: any) => {
      return await ctx.db.insert("ideas", {
        title: "Unscoped without event",
        pitch: "Must not disappear",
        problem: "No scope exists",
        targetAudience: "Maintainers",
        skillsNeeded: [],
        status: "exploring",
        lookingForRoles: [],
        ownerId: adminId,
      });
    })) as Id<"ideas">;

    await expect(
      asUser(withoutEvent, adminId, adminEmail).mutation(api.admin.deleteIdea, {
        ideaId: orphanedIdeaId,
      }),
    ).rejects.toThrow(
      "Cannot delete an unscoped idea without a configured hackathon",
    );
    expect(
      await withoutEvent.run(async (ctx: any) => ctx.db.get(orphanedIdeaId)),
    ).not.toBeNull();
    expect(await getDeletionJob(withoutEvent, orphanedIdeaId)).toBeNull();
  });
});
