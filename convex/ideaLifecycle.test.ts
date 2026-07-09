/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { asUser, initTest, insertUser } from "./testHelpers.test";

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

  const ids = await t.run(async (ctx: any) => {
    const ideaFields = {
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
      ideaId,
      userId: recipientId,
      memberRoles: ["developer"],
    });
    await ctx.db.insert("ideaInterest", { ideaId, userId: recipientId });
    const commentId = await ctx.db.insert("comments", {
      ideaId,
      userId: recipientId,
      content: "Root comment",
    });
    await ctx.db.insert("comments", {
      ideaId,
      userId: ownerId,
      content: "Reply",
      parentId: commentId,
    });
    await ctx.db.insert("reactions", {
      ideaId,
      userId: recipientId,
      type: "like",
    });
    await ctx.db.insert("resourceRequests", {
      ideaId,
      tag: "workspace",
      resolved: false,
    });
    await ctx.db.insert("ownershipTransferRequests", {
      ideaId,
      requesterId: ownerId,
      recipientId,
      leaveAfterTransfer: false,
      status: "pending",
    });
    await ctx.db.insert("relatedIdeas", {
      ideaIdA: ideaId,
      ideaIdB: relatedIdeaId,
      markedByUserId: ownerId,
      relationType: "related",
    });
    await ctx.db.insert("relatedIdeas", {
      ideaIdA: relatedIdeaId,
      ideaIdB: ideaId,
      markedByUserId: ownerId,
      relationType: "duplicate",
    });
    await ctx.db.insert("dismissedIdeas", { ideaId, userId: recipientId });
    await ctx.db.insert("ideaBookmarks", { ideaId, userId: recipientId });
    await ctx.db.insert("ideaVotes", {
      ideaId,
      userId: recipientId,
      round: 1,
      createdAt: Date.now(),
    });
    await ctx.db.insert("notifications", {
      recipientId,
      actorId: ownerId,
      ideaId,
      type: "comment_added",
      read: false,
      commentId,
    });
    await ctx.db.insert("notifications", {
      recipientId,
      actorId: ownerId,
      ideaId,
      type: "reaction_added",
      read: true,
    });
    const survivingNotificationId = await ctx.db.insert("notifications", {
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
}

describe("idea lifecycle deletion", () => {
  test("owner deletion removes every idea-owned record", async () => {
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);

    await asUser(t, fixture.ownerId, fixture.ownerEmail).mutation(
      api.ideas.remove,
      { ideaId: fixture.ideaId },
    );

    await expectIdeaLifecycleDeleted(t, fixture);
  });

  test("admin deletion uses the same complete lifecycle cascade", async () => {
    const t = initTest();
    const fixture = await seedLifecycleFixture(t);

    await asUser(t, fixture.adminId, fixture.adminEmail).mutation(
      api.admin.deleteIdea,
      { ideaId: fixture.ideaId },
    );

    await expectIdeaLifecycleDeleted(t, fixture);
  });
});
